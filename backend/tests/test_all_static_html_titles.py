"""
Teste unitário para garantia estrita de que NENHUM arquivo HTML estático em public/ possui títulos legados.
"""
import unittest
from pathlib import Path
import re

class TestAllStaticHtmlTitlesAreOraculo(unittest.TestCase):
    def setUp(self):
        self.public_dir = (
            Path(__file__).resolve().parents[2] / "frontend" / "public"
        )
        self.index_file = (
            Path(__file__).resolve().parents[2] / "frontend" / "index.html"
        )

    def test_all_public_html_titles_are_oraculo(self):
        """Varre todos os HTMLs estáticos para garantir que <title> é exclusivamente 'Oraculo'."""
        html_files = list(self.public_dir.glob("*.html")) + [self.index_file]
        self.assertGreater(len(html_files), 0, "Nenhum arquivo HTML encontrado.")

        for html_path in html_files:
            with open(html_path, "r", encoding="utf-8") as f:
                content = f.read()
            match = re.search(r"<title>(.*?)</title>", content, re.IGNORECASE)
            self.assertIsNotNone(match, f"Elemento <title> não encontrado em {html_path.name}")
            title_text = match.group(1).trim() if hasattr(match.group(1), 'trim') else match.group(1).strip()
            self.assertEqual(title_text, "Oraculo", f"Arquivo {html_path.name} possui título '{title_text}' ao invés de 'Oraculo'.")

if __name__ == "__main__":
    unittest.main(verbosity=2)
