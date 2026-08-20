import json
import time
import unittest
import urllib.parse
import urllib.request


class TestUsersManagement(unittest.TestCase):
    def setUp(self):
        self.login_url = "http://localhost:3131/auth/login"
        self.users_url = "http://localhost:3131/api/users"
        self.invites_url = "http://localhost:3131/api/users/invitations"
        self.register_url = "http://localhost:3131/api/users/register"
        self.me_url = "http://localhost:3131/api/me"

        # Login como Super Admin
        login_payload = json.dumps({
            "username": "aryarajmarketing@gmail.com",
            "password": "123456"
        }).encode("utf-8")
        login_req = urllib.request.Request(
            self.login_url,
            data=login_payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(login_req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            self.super_token = data["token"]
            self.super_headers = {
                "Authorization": f"Bearer {self.super_token}",
                "Content-Type": "application/json"
            }

    def test_full_users_flow(self):
        """Valida todo o ciclo de vida: convite, registro, autenticação e restrições de permissão"""

        # 1. Super Admin lista usuários (deve conter o Super Admin)
        req_list = urllib.request.Request(self.users_url, headers=self.super_headers, method="GET")
        with urllib.request.urlopen(req_list, timeout=5) as resp:
            self.assertEqual(resp.status, 200)
            users = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(len(users) >= 1)
            self.assertEqual(users[0]["id"], "super-admin")
            self.assertTrue(users[0]["isSuperAdmin"])

        # 2. Super Admin cria um convite para "user" com duração de 24 horas e permissões personalizadas
        invite_payload = json.dumps({
            "role": "user",
            "hours": 24,
            "permissions": {
                "carrosseis": "liberado",
                "criador": "em_breve",
                "criador_pct": 75,
                "radar": "bloqueado"
            }
        }).encode("utf-8")
        req_invite = urllib.request.Request(
            self.invites_url,
            data=invite_payload,
            headers=self.super_headers,
            method="POST"
        )
        with urllib.request.urlopen(req_invite, timeout=5) as resp:
            self.assertEqual(resp.status, 200)
            invite_data = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(invite_data["ok"])
            invite_id = invite_data["inviteId"]

        # 3. Verifica convite publicamente
        verify_url = f"{self.invites_url}/{invite_id}/verify"
        req_verify = urllib.request.Request(verify_url, method="GET")
        with urllib.request.urlopen(req_verify, timeout=5) as resp:
            self.assertEqual(resp.status, 200)
            verify_data = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(verify_data["valid"])
            self.assertEqual(verify_data["role"], "user")

        # 4. Registra novo usuário através do convite
        test_email = f"colaborador-{int(time.time())}@teste.com"
        register_payload = json.dumps({
            "inviteId": invite_id,
            "name": "Colaborador Teste",
            "email": test_email,
            "password": "senha-segura-123"
        }).encode("utf-8")
        req_register = urllib.request.Request(
            self.register_url,
            data=register_payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req_register, timeout=5) as resp:
            self.assertEqual(resp.status, 200)
            register_res = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(register_res["ok"])

        # 5. Verifica que o convite não é mais válido (foi aceito)
        try:
            with urllib.request.urlopen(req_verify, timeout=5) as resp:
                self.fail("Deveria ter retornado erro para convite aceito")
        except urllib.error.HTTPError as e:
            self.assertEqual(e.code, 400)

        # 6. Autentica com o novo colaborador
        user_login_payload = json.dumps({
            "username": test_email,
            "password": "senha-segura-123"
        }).encode("utf-8")
        user_login_req = urllib.request.Request(
            self.login_url,
            data=user_login_payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(user_login_req, timeout=5) as resp:
            self.assertEqual(resp.status, 200)
            user_auth_data = json.loads(resp.read().decode("utf-8"))
            user_token = user_auth_data["token"]
            user_headers = {
                "Authorization": f"Bearer {user_token}",
                "Content-Type": "application/json"
            }

        # 7. Novo colaborador chama /api/me e verifica que seu cargo é "user" e possui as permissões herdadas do convite
        req_me = urllib.request.Request(self.me_url, headers=user_headers, method="GET")
        with urllib.request.urlopen(req_me, timeout=5) as resp:
            self.assertEqual(resp.status, 200)
            me_data = json.loads(resp.read().decode("utf-8"))
            self.assertEqual(me_data["email"], test_email)
            self.assertEqual(me_data["role"], "user")
            self.assertFalse(me_data["isSuperAdmin"])
            self.assertEqual(me_data["permissions"]["carrosseis"], "liberado")
            self.assertEqual(me_data["permissions"]["criador"], "em_breve")
            self.assertEqual(me_data["permissions"]["criador_pct"], 75)
            self.assertEqual(me_data["permissions"]["radar"], "bloqueado")

        # 8. Novo colaborador tenta acessar listagem de usuários e recebe 403 (Forbidden)
        req_list_user = urllib.request.Request(self.users_url, headers=user_headers, method="GET")
        try:
            with urllib.request.urlopen(req_list_user, timeout=5) as resp:
                self.fail("Deveria ter bloqueado acesso com 403")
        except urllib.error.HTTPError as e:
            self.assertEqual(e.code, 403)

        # 9. Super Admin edita o novo colaborador no banco
        user_id = None
        with urllib.request.urlopen(req_list, timeout=5) as resp:
            users = json.loads(resp.read().decode("utf-8"))
            for u in users:
                if u["email"] == test_email:
                    user_id = u["id"]
                    break

        self.assertIsNotNone(user_id)

        edit_payload = json.dumps({
            "name": "Colaborador Editado",
            "email": test_email,
            "role": "admin",
            "permissions": {
                "carrosseis": "liberado",
                "criador": "liberado",
                "radar": "liberado"
            }
        }).encode("utf-8")
        req_edit = urllib.request.Request(
            f"{self.users_url}/{user_id}",
            data=edit_payload,
            headers=self.super_headers,
            method="PUT"
        )
        with urllib.request.urlopen(req_edit, timeout=5) as resp:
            self.assertEqual(resp.status, 200)
            edit_res = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(edit_res["ok"])

        # Verifica se as permissões foram atualizadas na listagem
        with urllib.request.urlopen(req_list, timeout=5) as resp:
            users = json.loads(resp.read().decode("utf-8"))
            for u in users:
                if u["email"] == test_email:
                    self.assertEqual(u["permissions"]["radar"], "liberado")
                    break

        # 10. Super Admin tenta editar ou excluir o Super Admin fictício e recebe 400
        req_edit_super = urllib.request.Request(
            f"{self.users_url}/super-admin",
            data=edit_payload,
            headers=self.super_headers,
            method="PUT"
        )
        try:
            with urllib.request.urlopen(req_edit_super, timeout=5) as resp:
                self.fail("Deveria ter rejeitado edição do super-admin")
        except urllib.error.HTTPError as e:
            self.assertEqual(e.code, 400)

        req_del_super = urllib.request.Request(f"{self.users_url}/super-admin", headers=self.super_headers, method="DELETE")
        try:
            with urllib.request.urlopen(req_del_super, timeout=5) as resp:
                self.fail("Deveria ter rejeitado deleção do super-admin")
        except urllib.error.HTTPError as e:
            self.assertEqual(e.code, 400)

        # 11. Super Admin exclui o colaborador promovido
        req_del = urllib.request.Request(f"{self.users_url}/{user_id}", headers=self.super_headers, method="DELETE")
        with urllib.request.urlopen(req_del, timeout=5) as resp:
            self.assertEqual(resp.status, 200)
            del_res = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(del_res["ok"])

        print("\n[OK] Teste completo de Gestão de Usuários passou com sucesso!")

if __name__ == '__main__':
    unittest.main()
