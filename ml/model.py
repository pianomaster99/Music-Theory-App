"""Lightweight, streaming-friendly CRNN for singing-voice pitch detection.

Designed for in-browser inference: small (~0.2M params), causal (left-padded
convs + a unidirectional GRU) so it can run frame-by-frame on a live audio
stream. Input is the log-mel front-end (T, N_MELS); outputs per-frame logits for
the 88 piano-key classes plus a voicing logit.
"""
from __future__ import annotations

import torch
import torch.nn as nn

import config as C


class CausalConv2d(nn.Module):
    """Conv2d that only looks left in time (causal) and is centred in frequency."""

    def __init__(self, c_in, c_out, k_t=3, k_f=3, stride_f=2):
        super().__init__()
        self.pad_t = k_t - 1
        pad_f = k_f // 2
        self.conv = nn.Conv2d(c_in, c_out, (k_t, k_f), stride=(1, stride_f), padding=(0, pad_f))
        self.bn = nn.BatchNorm2d(c_out)
        self.act = nn.ReLU(inplace=True)

    def forward(self, x):  # x: (B, C, T, F)
        x = nn.functional.pad(x, (0, 0, self.pad_t, 0))  # left-pad time only
        return self.act(self.bn(self.conv(x)))


class PitchCRNN(nn.Module):
    def __init__(self, n_mels=C.N_MELS, n_classes=C.N_PITCH_CLASSES,
                 conv_ch=(16, 32, 48), gru_hidden=96, gru_layers=1, dropout=0.3):
        super().__init__()
        chs = [1, *conv_ch]
        self.convs = nn.ModuleList(
            [CausalConv2d(chs[i], chs[i + 1]) for i in range(len(conv_ch))])
        feat_f = n_mels
        for _ in conv_ch:
            feat_f = (feat_f + 1) // 2  # stride-2 in freq
        # Spatial dropout on conv features + plain dropout on the recurrent
        # features fight the small-data overfitting we saw (train ~100% / val ~63%).
        self.conv_drop = nn.Dropout2d(dropout * 0.5)
        self.proj = nn.Linear(conv_ch[-1] * feat_f, gru_hidden)
        self.gru = nn.GRU(gru_hidden, gru_hidden, num_layers=gru_layers,
                          batch_first=True,
                          dropout=(dropout if gru_layers > 1 else 0.0))
        self.head_drop = nn.Dropout(dropout)
        self.pitch_head = nn.Linear(gru_hidden, n_classes)
        self.voice_head = nn.Linear(gru_hidden, 1)

    def forward(self, x, h=None):  # x: (B, T, n_mels)
        z = x.unsqueeze(1)                       # (B,1,T,F)
        for conv in self.convs:
            z = conv(z)                          # (B,C,T,F')
        z = self.conv_drop(z)
        b, c, t, f = z.shape
        z = z.permute(0, 2, 1, 3).reshape(b, t, c * f)
        z = torch.relu(self.proj(z))
        z, h = self.gru(z, h)
        z = self.head_drop(z)
        return self.pitch_head(z), self.voice_head(z).squeeze(-1), h

    def num_params(self) -> int:
        return sum(p.numel() for p in self.parameters())
