from transformers import AutoTokenizer, AutoModel
import torch
import numpy as np

_tok = None
_model = None
MODEL_ID = "sentence-transformers/all-MiniLM-L6-v2"


def _load():
    global _tok, _model
    if _tok is None:
        _tok = AutoTokenizer.from_pretrained(MODEL_ID)
        _model = AutoModel.from_pretrained(MODEL_ID)
        _model.eval()


def embed(text: str) -> list[float]:
    _load()
    tokens = _tok(text, return_tensors="pt", truncation=True, padding=True, max_length=512)
    with torch.no_grad():
        out = _model(**tokens)
    vec = out.last_hidden_state.mean(dim=1).squeeze().numpy()
    return vec.tolist()


def embed_batch(texts: list[str]) -> list[list[float]]:
    _load()
    tokens = _tok(texts, return_tensors="pt", truncation=True, padding=True, max_length=512)
    with torch.no_grad():
        out = _model(**tokens)
    vecs = out.last_hidden_state.mean(dim=1).numpy()
    return vecs.tolist()
