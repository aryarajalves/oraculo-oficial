import express from "express";
import crypto from "crypto";
import { query } from "../db.js";
import { 
  requireSuperAdmin, 
  getSuperAdminEmail, 
  hashPassword 
} from "../state.js";
import { logger } from '../logger.js';

const router = express.Router();

// Listar todos os usuários (Super Admin apenas)
router.get('/api/users', requireSuperAdmin, async (req, res) => {
  try {
    const dbUsers = await query("SELECT id, name, email, role, permissions, created_at FROM dashboard_users ORDER BY id ASC");
    
    // Insere o Super Admin virtual no topo da lista
    const superAdminUser = {
      id: 'super-admin',
      name: process.env.DASHBOARD_USER_NAME || 'Super Admin',
      email: getSuperAdminEmail(),
      role: 'admin',
      created_at: new Date().toISOString(),
      isSuperAdmin: true,
      permissions: {
        carrosseis: 'liberado',
        criador: 'liberado',
        calendario: 'liberado',
        reels: 'liberado',
        fabrica: 'liberado',
        oraculo: 'liberado',
        radar: 'liberado'
      }
    };
    
    const list = [superAdminUser, ...dbUsers.rows.map(u => ({ ...u, isSuperAdmin: false, permissions: u.permissions || {} }))];
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar usuários: ' + err.message });
  }
});

// Editar usuário (Super Admin apenas)
router.put('/api/users/:id', requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  if (id === 'super-admin') {
    return res.status(400).json({ error: 'O Super Admin do sistema não pode ser editado.' });
  }
  
  const { name, email, role, permissions } = req.body;
  if (!name || !email || !role) {
    return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
  }
  
  try {
    const checkUser = await query("SELECT * FROM dashboard_users WHERE id = $1", [id]);
    if (checkUser.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    
    const checkEmail = await query("SELECT * FROM dashboard_users WHERE email = $1 AND id <> $2", [email, id]);
    if (checkEmail.rows.length > 0 || email === getSuperAdminEmail()) {
      return res.status(400).json({ error: 'Este e-mail já está em uso.' });
    }
    
    await query(
      "UPDATE dashboard_users SET name = $1, email = $2, role = $3, permissions = $4 WHERE id = $5",
      [name, email, role, permissions || {}, id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao editar usuário: ' + err.message });
  }
});

// Excluir usuário (Super Admin apenas)
router.delete('/api/users/:id', requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  if (id === 'super-admin') {
    return res.status(400).json({ error: 'O Super Admin do sistema não pode ser excluído.' });
  }
  
  try {
    await query("DELETE FROM dashboard_users WHERE id = $1", [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao excluir usuário: ' + err.message });
  }
});

// Listar convites (Super Admin apenas)
router.get('/api/users/invitations', requireSuperAdmin, async (req, res) => {
  try {
    // Atualiza expirados automaticamente
    await query("UPDATE invitations SET status = 'expired' WHERE expires_at < CURRENT_TIMESTAMP AND status = 'pending'");
    const invites = await query("SELECT * FROM invitations ORDER BY created_at DESC");
    res.json(invites.rows.map(inv => ({ ...inv, permissions: inv.permissions || {} })));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao obter convites: ' + err.message });
  }
});

// Criar convite (Super Admin apenas)
router.post('/api/users/invitations', requireSuperAdmin, async (req, res) => {
  const { role, hours, permissions } = req.body;
  if (!role || !hours) {
    return res.status(400).json({ error: 'Preencha o cargo e o prazo de expiração.' });
  }
  
  const token = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
  const expiresAt = new Date(Date.now() + Number(hours) * 60 * 60 * 1000);
  
  try {
    await query(
      "INSERT INTO invitations (id, role, expires_at, status, permissions) VALUES ($1, $2, $3, $4, $5)",
      [token, role, expiresAt, 'pending', permissions || {}]
    );
    res.json({ ok: true, inviteId: token });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao gerar convite: ' + err.message });
  }
});

// Cancelar convite (Super Admin apenas)
router.post('/api/users/invitations/:id/revoke', requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await query("DELETE FROM invitations WHERE id = $1", [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao cancelar convite: ' + err.message });
  }
});

// Verificar validade do convite (PÚBLICO)
router.get('/api/users/invitations/:id/verify', async (req, res) => {
  const { id } = req.params;
  try {
    await query("UPDATE invitations SET status = 'expired' WHERE expires_at < CURRENT_TIMESTAMP AND status = 'pending'");
    const inviteRes = await query("SELECT * FROM invitations WHERE id = $1", [id]);
    if (inviteRes.rows.length === 0) {
      return res.status(404).json({ error: 'Convite não encontrado.' });
    }
    
    const invite = inviteRes.rows[0];
    if (invite.status !== 'pending') {
      return res.status(400).json({ error: `Este convite não está ativo. Status atual: ${invite.status}` });
    }
    
    res.json({ valid: true, role: invite.role });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao verificar convite: ' + err.message });
  }
});

// Registrar usuário usando um convite (PÚBLICO)
router.post('/api/users/register', async (req, res) => {
  const { inviteId, name, email, password } = req.body;
  if (!inviteId || !name || !email || !password) {
    return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
  }
  
  try {
    // 1. Verifica convite
    const inviteRes = await query("SELECT * FROM invitations WHERE id = $1", [inviteId]);
    if (inviteRes.rows.length === 0) {
      return res.status(404).json({ error: 'Convite não encontrado.' });
    }
    
    const invite = inviteRes.rows[0];
    if (invite.status !== 'pending' || new Date(invite.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Este convite expirou ou já foi utilizado.' });
    }
    
    // 2. Verifica e-mail duplicado
    const checkEmail = await query("SELECT * FROM dashboard_users WHERE email = $1", [email]);
    if (checkEmail.rows.length > 0 || email === getSuperAdminEmail()) {
      return res.status(400).json({ error: 'Este e-mail já está cadastrado no sistema.' });
    }
    
    // 3. Cadastra o novo usuário
    const hashedPassword = hashPassword(password);
    await query(
      "INSERT INTO dashboard_users (name, email, password, role, permissions) VALUES ($1, $2, $3, $4, $5)",
      [name, email, hashedPassword, invite.role, invite.permissions || {}]
    );
    
    // 4. Marca convite como aceito
    await query("UPDATE invitations SET status = 'accepted' WHERE id = $1", [inviteId]);
    
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao registrar usuário: ' + err.message });
  }
});

export default router;
