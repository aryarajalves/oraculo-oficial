"""
Teste unitário para a trava com MutationObserver garantindo o título 'Oraculo'.
"""
import unittest
from pathlib import Path

class TestTitleMutationObserverLock(unittest.TestCase):
    def setUp(self):
        self.main_path = (
            Path(__file__).resolve().parents[2] / "frontend" / "src" / "main.jsx"
        )
        self.login_path = (
            Path(__file__).resolve().parents[2] / "frontend" / "public" / "login.html"
        )

    def test_main_jsx_has_mutation_observer(self):
        """Verifica se main.jsx possui a trava com MutationObserver para document.title = 'Oraculo'."""
        with open(self.main_path, "r", encoding="utf-8") as f:
            content = f.read()
        self.assertIn("MutationObserver", content)
        self.assertIn('document.title = "Oraculo"', content)

    def test_login_html_has_mutation_observer(self):
        """Verifica se login.html possui a trava com MutationObserver para document.title = 'Oraculo'."""
        with open(self.login_path, "r", encoding="utf-8") as f:
            content = f.read()
        self.assertIn("MutationObserver", content)
        self.assertIn('document.title = "Oraculo"', content)

if __name__ == "__main__":
    unittest.main(verbosity=2)
