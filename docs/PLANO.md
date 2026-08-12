# Plano de inspeção dos PDFs de exemplo

**Data:** 2026-08-11

## Disponibilidade dos arquivos

Os PDFs listados em `exemplos/README.md` **não estavam presentes** no clone público do repositório `quick-filler/desafio-programador` nem disponíveis via download direto do GitHub (retorno 404/14 bytes). Apenas `exemplos/README.md` foi versionado.

Arquivos esperados:

| Arquivo | Tipo | Status no ambiente |
|---|---|---|
| `cartao-ponto-1.pdf` | Cartão de ponto | Ausente |
| `cartao-ponto-2.pdf` | Cartão de ponto | Ausente |
| `holerite-1.pdf` | Holerite | Ausente |
| `holerite-2.pdf` | Holerite | Ausente |

## Análise prevista (conforme README)

Com base na documentação oficial:

- **Parte dos exemplos é escaneada** (sem camada de texto) → exige fallback OCR por página via Poppler + Tesseract (`por`).
- **Cartão de ponto:** linhas por dia, batidas IN/OUT alternadas, possíveis dias sem batida, datas possivelmente não sequenciais.
- **Holerite:** tabela de verbas (`fields`) separada de bases/totais (`bases`); competência mês/ano por página.

## Estratégia de pipeline

1. Extrair texto embutido com `pdfjs-dist`.
2. Se `text.length < MIN_TEXT_LENGTH` (20), renderizar página com `pdftoppm` e OCR com `tesseract.js` (idioma português).
3. Encaminhar texto ao extrator conforme `tipo`.
4. Consolidar JSON público literal conforme README.

## Exceções observadas

Não foi possível inspecionar visualmente os PDFs reais neste ambiente. A validação final depende de o candidato adicionar os PDFs em `exemplos/` e reprocessar via `docker compose up`.
