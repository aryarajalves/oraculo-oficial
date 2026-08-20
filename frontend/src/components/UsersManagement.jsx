import React, { useState, useEffect } from 'react';
import InviteModal from './UsersManagement/InviteModal';
import EditUserModal from './UsersManagement/EditUserModal';
import DeleteUserModal from './UsersManagement/DeleteUserModal';
import DeleteInviteModal from './UsersManagement/DeleteInviteModal';
import UsersTable from './UsersManagement/UsersTable';
import InvitationsTable from './UsersManagement/InvitationsTable';

const defaultPermissions = {
  carrosseis: 'liberado',
  criador: 'liberado',
  calendario: 'liberado',
  biblioteca: 'liberado',
  reels: 'liberado',
  fabrica: 'liberado',
  oraculo: 'liberado',
  radar: 'liberado'
};

const PAGES_TO_CONTROL = [
  { id: 'carrosseis', label: 'Carrosséis' },
  { id: 'criador', label: 'Criador' },
  { id: 'calendario', label: 'Calendário' },
  { id: 'biblioteca', label: 'Biblioteca' },
  { id: 'reels', label: 'Clonador de Reels' },
  { id: 'fabrica', label: 'Fábrica de Vídeos' },
  { id: 'oraculo', label: 'Oráculo' },
  { id: 'radar', label: 'Radar' }
];

export default function UsersManagement({ showToast }) {
  const [activeSubTab, setActiveSubTab] = useState('users'); // 'users' ou 'invitations'
  const [users, setUsers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados de Modais
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState('user');
  const [inviteHours, setInviteHours] = useState('24');
  const [generatedLink, setGeneratedLink] = useState('');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [invitePermissions, setInvitePermissions] = useState(defaultPermissions);

  // Estados de Edição de Usuário
  const [editUserModalOpen, setEditUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('user');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editPermissions, setEditPermissions] = useState(defaultPermissions);

  // Estados de Deleção de Usuário
  const [deleteUserModalOpen, setDeleteUserModalOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // Estados de Deleção de Convite
  const [deleteInviteModalOpen, setDeleteInviteModalOpen] = useState(false);
  const [deletingInvite, setDeletingInvite] = useState(null);
  const [deleteInviteSubmitting, setDeleteInviteSubmitting] = useState(false);

  // Estados de Paginação
  const [usersPage, setUsersPage] = useState(1);
  const [usersPerPage, setUsersPerPage] = useState(5);
  const [invitesPage, setInvitesPage] = useState(1);
  const [invitesPerPage, setInvitesPerPage] = useState(5);

  useEffect(() => {
    loadData();
  }, [activeSubTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeSubTab === 'users') {
        const res = await fetch('/api/users');
        const data = await res.json();
        if (res.ok) setUsers(data);
      } else {
        const res = await fetch('/api/users/invitations');
        const data = await res.json();
        if (res.ok) setInvitations(data);
      }
    } catch (e) {
      showToast('Erro ao carregar dados de gestão.');
    } finally {
      setLoading(false);
    }
  };

  // Gerar Convite
  const handleCreateInvite = async (e) => {
    e.preventDefault();
    setInviteSubmitting(true);
    try {
      const res = await fetch('/api/users/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: inviteRole, hours: inviteHours, permissions: invitePermissions })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        const link = `${window.location.protocol}//${window.location.host}/register.html?invite=${data.inviteId}`;
        setGeneratedLink(link);
        showToast('Convite gerado com sucesso!');
        loadData();
      } else {
        showToast(data.error || 'Erro ao gerar convite.');
      }
    } catch (err) {
      showToast('Erro de rede ao gerar convite.');
    } finally {
      setInviteSubmitting(false);
    }
  };

  // Abrir modal de convite limpando dados
  const openInviteModal = () => {
    setGeneratedLink('');
    setInvitePermissions(defaultPermissions);
    setInviteModalOpen(true);
  };

  // Copiar link
  const handleCopyLink = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    showToast('Link copiado para a área de transferência!');
  };

  // Abrir Modal de Edição
  const openEditModal = (user) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditPermissions(user.permissions || defaultPermissions);
    setEditUserModalOpen(true);
  };

  // Salvar Edição
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, email: editEmail, role: editRole, permissions: editPermissions })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast('Usuário atualizado com sucesso.');
        setEditUserModalOpen(false);
        loadData();
      } else {
        showToast(data.error || 'Erro ao atualizar usuário.');
      }
    } catch (err) {
      showToast('Erro de rede ao atualizar usuário.');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Confirmar Deleção
  const handleConfirmDelete = async () => {
    if (!deletingUser) return;
    setDeleteSubmitting(true);
    try {
      const res = await fetch(`/api/users/${deletingUser.id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Usuário excluído com sucesso.');
        setDeleteUserModalOpen(false);
        loadData();
      } else {
        const data = await res.json();
        showToast(data.error || 'Erro ao excluir usuário.');
      }
    } catch (e) {
      showToast('Erro de rede ao excluir usuário.');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // Confirmar Deleção de Convite
  const handleConfirmDeleteInvite = async () => {
    if (!deletingInvite) return;
    setDeleteInviteSubmitting(true);
    try {
      const res = await fetch(`/api/users/invitations/${deletingInvite.id}/revoke`, { method: 'POST' });
      if (res.ok) {
        showToast('Convite excluído com sucesso.');
        setDeleteInviteModalOpen(false);
        loadData();
      } else {
        showToast('Erro ao excluir convite.');
      }
    } catch (e) {
      showToast('Erro de rede ao excluir convite.');
    } finally {
      setDeleteInviteSubmitting(false);
    }
  };

  // Paginação de Usuários
  const totalUsersPages = Math.ceil(users.length / usersPerPage) || 1;
  const paginatedUsers = users.slice((usersPage - 1) * usersPerPage, usersPage * usersPerPage);

  // Paginação de Convites
  const totalInvitesPages = Math.ceil(invitations.length / invitesPerPage) || 1;
  const paginatedInvitations = invitations.slice((invitesPage - 1) * invitesPerPage, invitesPage * invitesPerPage);

  return (
    <div>
      <div className="oraculo-header">
        <div>
          <div className="oraculo-title">GESTÃO DE USUÁRIOS</div>
          <div className="oraculo-subtitle">Gerencie os acessos do estúdio e crie convites temporários com níveis de acesso.</div>
        </div>
      </div>

      <div className="inner-tabs" style={{ display: 'flex', gap: '16px', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '10px', paddingLeft: '16px' }}>
        <button
          className={`inner-tab-btn ${activeSubTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('users')}
          style={{
            background: activeSubTab === 'users' ? 'rgba(255,255,255,0.05)' : 'transparent',
            border: activeSubTab === 'users' ? '1px solid var(--border)' : '1px solid transparent',
            color: activeSubTab === 'users' ? 'var(--text)' : 'var(--text-3)',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '600',
            transition: 'all 0.2s'
          }}
        >
          Usuários Cadastrados
        </button>
        <button
          className={`inner-tab-btn ${activeSubTab === 'invitations' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('invitations')}
          style={{
            background: activeSubTab === 'invitations' ? 'rgba(255,255,255,0.05)' : 'transparent',
            border: activeSubTab === 'invitations' ? '1px solid var(--border)' : '1px solid transparent',
            color: activeSubTab === 'invitations' ? 'var(--text)' : 'var(--text-3)',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '600',
            transition: 'all 0.2s'
          }}
        >
          Convites Enviados
        </button>
      </div>

      {activeSubTab === 'users' && (
        <div className="section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '0 4px' }}>
            <div style={{ fontSize: '14px', color: 'var(--text-2)' }}>Lista de usuários cadastrados no estúdio</div>
            <button className="btn btn-gold btn-sm" onClick={openInviteModal}>+ Novo Usuário</button>
          </div>

          {loading ? (
            <div className="empty">
              <div className="spinner"></div>
              <div className="empty-text">Carregando usuários...</div>
            </div>
          ) : (
            <UsersTable
              paginatedUsers={paginatedUsers}
              usersPage={usersPage}
              setUsersPage={setUsersPage}
              usersPerPage={usersPerPage}
              setUsersPerPage={setUsersPerPage}
              totalUsersPages={totalUsersPages}
              openEditModal={openEditModal}
              setDeletingUser={setDeletingUser}
              setDeleteUserModalOpen={setDeleteUserModalOpen}
            />
          )}
        </div>
      )}

      {activeSubTab === 'invitations' && (
        <div className="section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', color: 'var(--text-2)' }}>Histórico de convites para cadastro no estúdio</div>
            <button className="btn btn-gold btn-sm" onClick={openInviteModal}>+ Novo Convite</button>
          </div>

          {loading ? (
            <div className="empty">
              <div className="spinner"></div>
              <div className="empty-text">Carregando convites...</div>
            </div>
          ) : invitations.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">✉</div>
              <div className="empty-text">Nenhum convite gerado.</div>
              <div className="empty-sub">Clique em "+ Novo Convite" para liberar acesso para um novo colaborador.</div>
            </div>
          ) : (
            <InvitationsTable
              paginatedInvitations={paginatedInvitations}
              invitesPage={invitesPage}
              setInvitesPage={setInvitesPage}
              invitesPerPage={invitesPerPage}
              setInvitesPerPage={setInvitesPerPage}
              totalInvitesPages={totalInvitesPages}
              setDeletingInvite={setDeletingInvite}
              setDeleteInviteModalOpen={setDeleteInviteModalOpen}
              showToast={showToast}
            />
          )}
        </div>
      )}

      {/* Modal: Novo Convite */}
      <InviteModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        inviteRole={inviteRole}
        setInviteRole={setInviteRole}
        inviteHours={inviteHours}
        setInviteHours={setInviteHours}
        invitePermissions={invitePermissions}
        setInvitePermissions={setInvitePermissions}
        inviteSubmitting={inviteSubmitting}
        onSubmit={handleCreateInvite}
        generatedLink={generatedLink}
        setGeneratedLink={setGeneratedLink}
        handleCopyLink={handleCopyLink}
        PAGES_TO_CONTROL={PAGES_TO_CONTROL}
      />

      {/* Modal: Editar Usuário */}
      <EditUserModal
        isOpen={editUserModalOpen}
        onClose={() => setEditUserModalOpen(false)}
        editingUser={editingUser}
        editName={editName}
        setEditName={setEditName}
        editEmail={editEmail}
        setEditEmail={setEditEmail}
        editRole={editRole}
        setEditRole={setEditRole}
        editPermissions={editPermissions}
        setEditPermissions={setEditPermissions}
        editSubmitting={editSubmitting}
        onSubmit={handleSaveEdit}
        PAGES_TO_CONTROL={PAGES_TO_CONTROL}
      />

      {/* Modal: Excluir Usuário */}
      <DeleteUserModal
        isOpen={deleteUserModalOpen}
        onClose={() => setDeleteUserModalOpen(false)}
        deletingUser={deletingUser}
        onSubmit={handleConfirmDelete}
        deleteSubmitting={deleteSubmitting}
      />

      {/* Modal: Excluir Convite */}
      <DeleteInviteModal
        isOpen={deleteInviteModalOpen}
        onClose={() => setDeleteInviteModalOpen(false)}
        deletingInvite={deletingInvite}
        onSubmit={handleConfirmDeleteInvite}
        deleteInviteSubmitting={deleteInviteSubmitting}
      />
    </div>
  );
}
