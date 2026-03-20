"""
A100-Kernel-RL Architecture Diagram
Generates a comprehensive architecture overview matching the project presentation style.
Run: python docs/architecture_diagram.py
Output: docs/architecture_diagram.png
"""

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import matplotlib.patheffects as pe
import numpy as np

# ── Color palette (matches slides) ──────────────────────────────────────────
BG       = "#0d0d0d"
TEAL     = "#3ab8c8"
TEAL_DK  = "#1a6b7a"
GREEN    = "#4a7c59"
GREEN_LT = "#6aab4a"
YELLOW   = "#b8960a"
YELLOW_LT= "#d4a800"
RED      = "#a03030"
WHITE    = "#e8e8e8"
GRAY     = "#555555"
ORANGE   = "#c87820"

fig = plt.figure(figsize=(20, 24), facecolor=BG)

# ── Helper functions ─────────────────────────────────────────────────────────

def box(ax, x, y, w, h, label, sublabel=None,
        fc=TEAL_DK, ec=TEAL, lw=2, fontsize=11, subfontsize=8):
    rect = FancyBboxPatch((x - w/2, y - h/2), w, h,
                          boxstyle="round,pad=0.03",
                          facecolor=fc, edgecolor=ec, linewidth=lw,
                          zorder=3)
    ax.add_patch(rect)
    dy = 0.12 if sublabel else 0
    ax.text(x, y + dy, label, ha="center", va="center",
            color=WHITE, fontsize=fontsize, fontweight="bold", zorder=4)
    if sublabel:
        ax.text(x, y - 0.18, sublabel, ha="center", va="center",
                color=TEAL, fontsize=subfontsize, zorder=4)

def arrow(ax, x0, y0, x1, y1, color=WHITE, lw=1.5, label=None, label_color=None):
    ax.annotate("", xy=(x1, y1), xytext=(x0, y0),
                arrowprops=dict(arrowstyle="-|>", color=color,
                                lw=lw, mutation_scale=14),
                zorder=5)
    if label:
        mx, my = (x0+x1)/2, (y0+y1)/2
        ax.text(mx + 0.05, my, label, color=label_color or color,
                fontsize=8, ha="left", va="center", zorder=6)

def dashed_arrow(ax, x0, y0, x1, y1, color=GRAY, label=None, label_color=None):
    ax.annotate("", xy=(x1, y1), xytext=(x0, y0),
                arrowprops=dict(arrowstyle="-|>", color=color, lw=1.5,
                                linestyle="dashed", mutation_scale=12),
                zorder=5)
    if label:
        mx, my = (x0+x1)/2, (y0+y1)/2
        ax.text(mx + 0.05, my, label, color=label_color or color,
                fontsize=8, ha="left", va="center", zorder=6)

def section_title(ax, x, y, text, color=TEAL):
    ax.text(x, y, text, ha="center", va="center",
            color=color, fontsize=14, fontweight="bold",
            fontfamily="monospace", zorder=6)

def outer_loop_box(ax, x0, y0, x1, y1, label, color=GRAY, lw=1.5):
    w, h = x1-x0, y1-y0
    rect = FancyBboxPatch((x0, y0), w, h,
                          boxstyle="round,pad=0.02",
                          facecolor="none", edgecolor=color,
                          linewidth=lw, linestyle="--", zorder=1)
    ax.add_patch(rect)
    ax.text((x0+x1)/2, y1 - 0.06, label, ha="center", va="top",
            color=color, fontsize=9, fontweight="bold",
            fontfamily="monospace", zorder=2)


# ════════════════════════════════════════════════════════════════════════════
# PANEL 1 — Self-Improving Loop (top, full width)
# ════════════════════════════════════════════════════════════════════════════
ax1 = fig.add_axes([0.03, 0.70, 0.94, 0.28], facecolor=BG)
ax1.set_xlim(0, 10); ax1.set_ylim(0, 3.5)
ax1.axis("off")

section_title(ax1, 5, 3.3, "SELF-IMPROVING LOOP")

# Outer dashed border
outer_loop_box(ax1, 0.1, 0.2, 9.9, 3.1, "")

# ── Top row boxes ────────────────────────────────────────────────────────────
box(ax1, 1.5, 2.3, 1.8, 0.9,
    "Curriculum\nScheduler",
    "DoubleGraph 192K\n+ Ops-6K",
    fc="#1a3a4a", ec=TEAL)

box(ax1, 3.5, 2.3, 1.6, 0.9,
    "OpenEnv Gym",
    "multi-turn rollout\nnvcc local compile",
    fc="#1a3a2a", ec=GREEN_LT)

box(ax1, 5.6, 2.3, 1.8, 0.9,
    "Qwen3-Coder\n30B (MoE)",
    "3.3B active · QLoRA 4-bit\nUnsloth + LoRA r=16",
    fc=TEAL_DK, ec=TEAL)

box(ax1, 7.8, 2.3, 1.8, 0.9,
    "Evaluator",
    "nvcc compile\nModal A100 bench\nPAC Reasoning",
    fc="#2a1a0a", ec=ORANGE)

# ── Top row arrows ───────────────────────────────────────────────────────────
arrow(ax1, 2.41, 2.3, 2.69, 2.3, color=WHITE)
arrow(ax1, 4.31, 2.3, 4.69, 2.3, color=WHITE)
arrow(ax1, 6.51, 2.3, 6.89, 2.3, color=WHITE)

# ── Reward label ─────────────────────────────────────────────────────────────
ax1.text(7.8, 1.65, "reward", ha="center", va="center",
         color=YELLOW_LT, fontsize=9, fontweight="bold")
ax1.text(7.8, 1.45, "log(speedup) + occupancy\n+ warp eff + mem coal.",
         ha="center", va="center", color=YELLOW, fontsize=7.5)

# ── GRPO update box ──────────────────────────────────────────────────────────
box(ax1, 5.6, 0.75, 2.6, 0.75,
    "GRPO gradient update",
    "TRL/TRLOO · Unsloth · H200/H100",
    fc="#1a1a0a", ec=YELLOW, lw=1.5)

# ── Stage Controller box ─────────────────────────────────────────────────────
box(ax1, 3.1, 0.75, 2.0, 0.75,
    "Stage Controller",
    "Stage1→2→3\nmastery tracking",
    fc="#1a2a1a", ec=GREEN_LT, lw=1.5)

# ── Arrows: reward flow ──────────────────────────────────────────────────────
arrow(ax1, 7.8, 1.85, 7.8, 1.75, color=YELLOW_LT)       # evaluator → reward label
arrow(ax1, 7.8, 1.15, 7.8, 1.14, color=YELLOW_LT)        # reward → stage ctrl (right)
# evaluator down to stage ctrl
ax1.annotate("", xy=(4.11, 0.75), xytext=(7.8, 1.13),
             arrowprops=dict(arrowstyle="-|>", color=YELLOW_LT, lw=1.5,
                             connectionstyle="arc3,rad=-0.25"), zorder=5)

# stage ctrl → GRPO
arrow(ax1, 4.11, 0.75, 4.29, 0.75, color=GREEN_LT)

# GRPO → model (back up)
ax1.annotate("", xy=(5.6, 1.85), xytext=(5.6, 1.13),
             arrowprops=dict(arrowstyle="-|>", color=GREEN_LT, lw=1.5), zorder=5)

# stage ctrl → curriculum (weak spots)
ax1.annotate("", xy=(1.5, 1.85), xytext=(2.1, 0.75),
             arrowprops=dict(arrowstyle="-|>", color=GRAY, lw=1.5,
                             linestyle="dashed",
                             connectionstyle="arc3,rad=0.2"), zorder=5)
ax1.text(1.3, 1.2, "weak spots\n& difficulty", ha="center", va="center",
         color=GRAY, fontsize=7.5)


# ════════════════════════════════════════════════════════════════════════════
# PANEL 2 — 3-Turn Iteration  (middle-left)
# ════════════════════════════════════════════════════════════════════════════
ax2 = fig.add_axes([0.03, 0.38, 0.44, 0.30], facecolor=BG)
ax2.set_xlim(0, 8); ax2.set_ylim(0, 5)
ax2.axis("off")

section_title(ax2, 4, 4.7, "3-TURN ITERATION")

def turn_row(ax, y, label, compile_ok, reward_text, reward_color):
    ax.text(0.4, y, label, ha="left", va="center",
            color=WHITE, fontsize=10, fontweight="bold")

    # Code box
    box(ax, 2.3, y, 1.1, 0.52, "Code", fc="#1a3a4a", ec=TEAL, fontsize=9)
    # nvcc box
    box(ax, 3.7, y, 1.1, 0.52, "nvcc", fc="#2a1a0a", ec=ORANGE, fontsize=9)

    # compile result
    if compile_ok:
        ax.text(4.7, y, "✓", ha="center", va="center",
                color=GREEN_LT, fontsize=16, fontweight="bold")
        # A100 Eval box
        box(ax, 5.9, y, 1.3, 0.52, "A100 Eval",
            fc="#1a2a1a", ec=GREEN_LT, fontsize=9)
        arrow(ax, 5.05, y, 5.22, y, color=GREEN_LT)
        arrow(ax, 6.56, y, 6.7, y, color=reward_color)
        ax.text(7.1, y, reward_text, ha="center", va="center",
                color=reward_color, fontsize=11, fontweight="bold")
    else:
        ax.text(4.7, y, "✗", ha="center", va="center",
                color=RED, fontsize=16, fontweight="bold")
        # Feedback box
        box(ax, 5.9, y, 1.3, 0.52, "Feedback",
            fc="#2a0a0a", ec=RED, fontsize=9)
        arrow(ax, 5.05, y, 5.22, y, color=RED)

    # Code→nvcc arrow
    arrow(ax, 2.86, y, 3.14, y, color=WHITE)

turn_row(ax2, 3.7, "Turn 1", compile_ok=False,  reward_text="",     reward_color=RED)
turn_row(ax2, 2.4, "Turn 2", compile_ok=True,   reward_text="r=+1", reward_color=YELLOW_LT)
turn_row(ax2, 1.1, "Turn 3", compile_ok=True,   reward_text="r=+3 ★", reward_color=YELLOW)

ax2.text(4.0, 0.35, "Local compile saves ~50% eval cost",
         ha="center", va="center", color=GREEN_LT,
         fontsize=9, fontstyle="italic")


# ════════════════════════════════════════════════════════════════════════════
# PANEL 3 — Reward Milestones  (middle-right)
# ════════════════════════════════════════════════════════════════════════════
ax3 = fig.add_axes([0.52, 0.38, 0.44, 0.30], facecolor=BG)
ax3.set_xlim(0, 5); ax3.set_ylim(-1.8, 4.0)
ax3.axis("off")

section_title(ax3, 2.5, 3.7, "REWARD MILESTONES")

bars = [
    (0.6,  -1, RED,       "Fail",           "-1"),
    (1.7,   1, YELLOW_LT, "Correct",        "+1"),
    (2.9,   2, GREEN,     "Beats\neager",   "+2"),
    (4.1,   3, YELLOW,    "Beats\ncompile", "+3"),
]

bar_w = 0.65
for bx, bh, bc, blabel, bval in bars:
    if bh > 0:
        rect = FancyBboxPatch((bx - bar_w/2, 0), bar_w, bh * 0.9,
                              boxstyle="square,pad=0.0",
                              facecolor=bc, edgecolor=bc, linewidth=0, zorder=3)
        ax3.add_patch(rect)
        ax3.text(bx, bh * 0.9 + 0.15, bval, ha="center", va="bottom",
                 color=WHITE, fontsize=12, fontweight="bold", zorder=4)
    else:
        rect = FancyBboxPatch((bx - bar_w/2, bh * 0.9), bar_w, abs(bh) * 0.9,
                              boxstyle="square,pad=0.0",
                              facecolor=bc, edgecolor=bc, linewidth=0, zorder=3)
        ax3.add_patch(rect)
        ax3.text(bx, bh * 0.9 - 0.2, bval, ha="center", va="top",
                 color=WHITE, fontsize=12, fontweight="bold", zorder=4)
    ax3.text(bx, -1.35, blabel, ha="center", va="center",
             color=WHITE, fontsize=8.5, zorder=4)

# baseline
ax3.axhline(0, color=GRAY, lw=1, zorder=2)

# star on +3
ax3.text(4.1, 3.0, "●", ha="center", va="bottom",
         color=WHITE, fontsize=14, zorder=5)

ax3.text(2.5, -1.65,
         "Discrete > Continuous:  96.8% vs 60.4% task success",
         ha="center", va="center", color=GREEN_LT,
         fontsize=8.5, fontstyle="italic")


# ════════════════════════════════════════════════════════════════════════════
# PANEL 4 — GRPO + TRLOO  (bottom-left)
# ════════════════════════════════════════════════════════════════════════════
ax4 = fig.add_axes([0.03, 0.08, 0.44, 0.28], facecolor=BG)
ax4.set_xlim(0, 6); ax4.set_ylim(0, 5)
ax4.axis("off")

section_title(ax4, 3.0, 4.7, "GRPO + TRLOO")

# Prompt box
box(ax4, 3.0, 3.8, 1.5, 0.6, "Prompt", fc=TEAL_DK, ec=TEAL, fontsize=11)
ax4.text(4.6, 3.8, "G = 2", ha="left", va="center",
         color=ORANGE, fontsize=11, fontweight="bold")

# c1, c2 boxes
box(ax4, 1.8, 2.3, 1.2, 0.6, "c₁", fc="#1a1a0a", ec=YELLOW_LT, fontsize=13)
box(ax4, 4.2, 2.3, 1.2, 0.6, "c₂", fc="#1a1a0a", ec=YELLOW_LT, fontsize=13)

# Prompt → c1, c2
ax4.annotate("", xy=(1.8, 2.62), xytext=(2.7, 3.49),
             arrowprops=dict(arrowstyle="-|>", color=GRAY, lw=1.5), zorder=5)
ax4.annotate("", xy=(4.2, 2.62), xytext=(3.3, 3.49),
             arrowprops=dict(arrowstyle="-|>", color=GRAY, lw=1.5), zorder=5)

# rewards
ax4.text(1.8, 1.85, "r₁ = 1", ha="center", va="center",
         color=YELLOW_LT, fontsize=10, fontweight="bold")
ax4.text(4.2, 1.85, "r₂ = 3", ha="center", va="center",
         color=YELLOW, fontsize=10, fontweight="bold")

# TRLOO arrow (c1 → c2, green)
ax4.annotate("", xy=(3.58, 1.85), xytext=(2.42, 1.85),
             arrowprops=dict(arrowstyle="-|>", color=GREEN_LT, lw=2.5), zorder=5)

# Formulas
ax4.text(1.5, 1.2,
         r"$A_i = \dfrac{r_i - \bar{r}}{\sigma_r}$",
         ha="center", va="center", color=WHITE, fontsize=13, zorder=4)

ax4.text(4.2, 1.2,
         r"$A_i^{\mathrm{TRLOO}} = A_i \cdot \dfrac{G}{G-1}$",
         ha="center", va="center", color=WHITE, fontsize=13, zorder=4)

ax4.text(2.4, 0.6, "Full gradient restored", ha="center", va="center",
         color=GREEN_LT, fontsize=9, fontstyle="italic")

# gradient signal arrow
ax4.annotate("", xy=(4.5, 0.25), xytext=(1.5, 0.25),
             arrowprops=dict(arrowstyle="-|>", color=TEAL, lw=2.5), zorder=5)
ax4.text(3.0, 0.1, "gradient signal", ha="center", va="top",
         color=WHITE, fontsize=9)


# ════════════════════════════════════════════════════════════════════════════
# PANEL 5 — Training Pipeline  (bottom-right)
# ════════════════════════════════════════════════════════════════════════════
ax5 = fig.add_axes([0.52, 0.08, 0.44, 0.28], facecolor=BG)
ax5.set_xlim(0, 9); ax5.set_ylim(0, 5)
ax5.axis("off")

section_title(ax5, 4.5, 4.7, "TRAINING PIPELINE")

stages = [
    (1.3, "Stage 1\nWarmup GRPO", "LR=2e-6 · 100 steps\nEasy: relu, softmax…",
     TEAL_DK, TEAL),
    (4.5, "Stage 2\nRFT",         "SFT · 192 expert kernels\n3 epochs",
     GREEN,   GREEN_LT),
    (7.7, "Stage 3\nCurriculum GRPO", "LR=3e-6 · 50 steps\n224 tasks · 4 phases",
     "#3a2a00", YELLOW),
]

for sx, slabel, ssub, sfc, sec in stages:
    box(ax5, sx, 3.0, 2.2, 1.2, slabel, ssub,
        fc=sfc, ec=sec, fontsize=10, subfontsize=8)

# arrows between stages
arrow(ax5, 2.41, 3.0, 3.38, 3.0, color=WHITE, lw=2)
arrow(ax5, 5.61, 3.0, 6.58, 3.0, color=WHITE, lw=2)

# common config box
config_rect = FancyBboxPatch((1.2, 0.7), 6.6, 0.65,
                             boxstyle="round,pad=0.04",
                             facecolor="#111111", edgecolor=GRAY,
                             linewidth=1.5, zorder=3)
ax5.add_patch(config_rect)
ax5.text(4.5, 1.03,
         "bf16  |  LoRA r=16  |  max_seq=8192  |  paged_adamw_8bit",
         ha="center", va="center", color=WHITE,
         fontsize=9, fontfamily="monospace", zorder=4)

# subtitle
ax5.text(4.5, 0.35,
         "Unsloth + QLoRA 4-bit  ·  Modal H200/H100 training",
         ha="center", va="center", color=GRAY, fontsize=8.5, fontstyle="italic")


# ── Save ──────────────────────────────────────────────────────────────────────
out = "docs/architecture_diagram.png"
plt.savefig(out, dpi=150, bbox_inches="tight",
            facecolor=BG, edgecolor="none")
print(f"Saved → {out}")
