"""
Teste unitário para validação da atualização do modelo de imagem em regen-slide.py.
"""
import unittest
from pathlib import Path

class TestRegenSlideScript(unittest.TestCase):
    def setUp(self):
        self.script_path = (
            Path(__file__).resolve().parents[2] / "backend" / "regen-slide.py"
        )
        self.assertTrue(self.script_path.exists(), f"regen-slide.py não encontrado em {self.script_path}")
        with open(self.script_path, "r", encoding="utf-8") as f:
            self.content = f.read()

    def test_uses_imagen_3_model(self):
        """Verifica se o modelo foi alterado para o Imagen 3 oficial."""
        self.assertIn("imagen-3.0-generate-002", self.content, "Modelo Imagen 3 não encontrado no regen-slide.py.")

    def test_uses_predict_endpoint(self):
        """Verifica se o endpoint correto do Imagen 3 (:predict) está sendo utilizado."""
        self.assertIn(":predict", self.content, "Endpoint :predict não encontrado no regen-slide.py.")

if __name__ == "__main__":
    unittest.main(verbosity=2)
