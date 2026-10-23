"""Draw the manuscript figures from output/paper/results.json.

Run after scripts/paper/run-experiments.ts:
    python3 scripts/paper/make-figures.py   (needs matplotlib)
"""

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "output" / "paper" / "figures"
OUT.mkdir(parents=True, exist_ok=True)
R = json.loads((ROOT / "output" / "paper" / "results.json").read_text())

PHASES = ["cowCalf", "stocker", "feedlot", "packer", "retail"]
LABELS = {
    "cowCalf": "Cow-calf",
    "stocker": "Stocker",
    "feedlot": "Feedlot",
    "packer": "Packer",
    "retail": "Retail",
}
# Validated categorical order (dataviz reference palette, light mode).
STAGE_COLORS = {
    "cowCalf": "#2a78d6",
    "stocker": "#eb6834",
    "feedlot": "#1baf7a",
    "packer": "#eda100",
    "retail": "#e87ba4",
}
INK, INK2, MUTED, GRID, AXIS = "#0b0b0b", "#52514e", "#898781", "#e1e0d9", "#c3c2b7"
BLUE, ORANGE = "#2a78d6", "#eb6834"
RHO_RAMP = ["#86b6ef", "#2a78d6", "#104281"]  # ordinal: rho 0 -> 0.95

plt.rcParams.update(
    {
        "font.family": "Arial",
        "font.size": 9,
        "axes.edgecolor": AXIS,
        "axes.labelcolor": INK2,
        "axes.titlesize": 10,
        "axes.titleweight": "bold",
        "axes.titlecolor": INK,
        "xtick.color": MUTED,
        "ytick.color": MUTED,
        "xtick.labelcolor": INK2,
        "ytick.labelcolor": INK2,
        "axes.spines.top": False,
        "axes.spines.right": False,
        "axes.grid": True,
        "grid.color": GRID,
        "grid.linewidth": 0.6,
        "axes.axisbelow": True,
        "legend.frameon": False,
        "savefig.dpi": 300,
        "savefig.bbox": "tight",
        "savefig.facecolor": "white",
    }
)


def mil(value):
    return value / 1e6


def save(fig, name):
    fig.savefig(OUT / name)
    plt.close(fig)


# Figure 1: schematic of the integrated chain.
def figure1():
    fig, ax = plt.subplots(figsize=(7.2, 3.1))
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 44)
    ax.axis("off")
    boxes = [
        ("cowCalf", "Cow-calf", "85 lb calf\n210 d, 2.33 lb/d"),
        ("stocker", "Stocker", "150 d\n1.5 lb/d"),
        ("feedlot", "Feedlot", "180 d, 3.3 lb/d\n28 lb DM/d feed"),
        ("packer", "Packer", "7 d; dressing %\nx saleable yield\n+ byproduct credit"),
        ("retail", "Retail", "23 d; $1.55/lb\nstore cost; sells at\nretail x grade index"),
    ]
    width, gap, y0, height = 15.2, 5.0, 18, 15
    xs = [1 + i * (width + gap) for i in range(len(boxes))]
    for (key, title, body), x in zip(boxes, xs):
        ax.add_patch(
            FancyBboxPatch(
                (x, y0),
                width,
                height,
                boxstyle="round,pad=0.3,rounding_size=1.2",
                linewidth=1.4,
                edgecolor=STAGE_COLORS[key],
                facecolor="white",
            )
        )
        ax.text(x + width / 2, y0 + height - 3.2, title, ha="center", va="center",
                fontsize=10, fontweight="bold", color=INK)
        ax.text(x + width / 2, y0 + 5.6, body, ha="center", va="center",
                fontsize=6.8, color=INK2, linespacing=1.35)
    handoffs = ["Weaned calf\n$/cwt", "Feeder\n$/cwt", "Fed steer\n$/cwt", "Wholesale\n$/lb x grade"]
    for i, label in enumerate(handoffs):
        x_start = xs[i] + width + 0.4
        x_end = xs[i + 1] - 0.4
        ax.add_patch(
            FancyArrowPatch((x_start, y0 + height / 2), (x_end, y0 + height / 2),
                            arrowstyle="-|>", mutation_scale=10, color=INK2, linewidth=1.1)
        )
        ax.text((x_start + x_end) / 2, y0 + height + 4.2, label, ha="center",
                va="center", fontsize=6.8, color=INK2, linespacing=1.2)
    ax.text(50, 41.5, "Live animal and carcass flow (100,000 weighted head; 2,500 representative agents)",
            ha="center", fontsize=8, color=INK)
    ax.text(50, 12.3,
            "Stochastic inputs per trial: correlated lognormal price shocks (calf, feeder, fed, wholesale, retail; "
            "common factor ρ = 0.65), feed-cost shock,",
            ha="center", fontsize=7.2, color=INK2)
    ax.text(50, 8.6,
            "animal-level start weight, days on feed and ADG multipliers, Bernoulli mortality "
            "(1.5%, 0.8%, 1.2%). 500 Monte Carlo trials per scenario.",
            ha="center", fontsize=7.2, color=INK2)
    ax.text(50, 3.2,
            "USDA reference-year inputs (2015–2025): ERS prices, price spreads, cow-calf costs, corn price; "
            "AMS grading and boxed-beef reports",
            ha="center", fontsize=7.2, color=MUTED, style="italic")
    save(fig, "fig1-model-schematic.png")


# Figure 2: S1 economic profit by stage with P10-P90 range.
def figure2():
    s1 = R["s1"]
    rows = PHASES + ["chain"]
    names = [LABELS[k] for k in PHASES] + ["Whole chain"]
    med = [mil(s1["phases"][k]["economicProfit"]) for k in PHASES] + [mil(s1["chain"]["economicProfit"])]
    p10 = [mil(s1["phases"][k]["p10"]) for k in PHASES] + [mil(s1["chain"]["p10"])]
    p90 = [mil(s1["phases"][k]["p90"]) for k in PHASES] + [mil(s1["chain"]["p90"])]
    fig, ax = plt.subplots(figsize=(6.6, 3.4))
    y = list(range(len(rows)))[::-1]
    colors = [BLUE] * len(PHASES) + [INK2]
    ax.barh(y, med, height=0.55, color=colors, zorder=2)
    for yi, lo, hi in zip(y, p10, p90):
        ax.plot([lo, hi], [yi, yi], color=INK, linewidth=1.2, zorder=3)
        ax.plot([lo, lo], [yi - 0.14, yi + 0.14], color=INK, linewidth=1.2, zorder=3)
        ax.plot([hi, hi], [yi - 0.14, yi + 0.14], color=INK, linewidth=1.2, zorder=3)
    for yi, value, hi, lo in zip(y, med, p90, p10):
        x = max(hi, value) + 6 if value >= 0 else min(lo, value) - 6
        text = f"${value:,.1f}M" if value >= 0 else f"\u2212${-value:,.1f}M"
        ax.text(x, yi, text, va="center",
                ha="left" if value >= 0 else "right", fontsize=8, color=INK)
    ax.axvline(0, color=AXIS, linewidth=1)
    ax.set_yticks(y, names)
    ax.grid(axis="y", visible=False)
    ax.set_xlabel("Economic profit, million US$ (median; whiskers = P10–P90 across 500 trials)")
    ax.set_xlim(-130, 230)
    save(fig, "fig3-s1-stage-profit.png")


# Figure 3: S2 historical retrospective.
def figure3():
    s2 = R["s2"]
    years = [row["referenceYear"] for row in s2]
    fig, (a, b) = plt.subplots(1, 2, figsize=(7.4, 3.2), gridspec_kw={"wspace": 0.38})
    chain = [mil(r["chain"]["economicProfit"]) for r in s2]
    lo = [mil(r["chain"]["p10"]) for r in s2]
    hi = [mil(r["chain"]["p90"]) for r in s2]
    a.fill_between(years, lo, hi, color="#cde2fb", linewidth=0, label="P10–P90")
    a.plot(years, chain, color=BLUE, linewidth=2, marker="o", markersize=4, label="Median")
    a.axhline(0, color=AXIS, linewidth=1)
    a.set_title("(A) Whole-chain economic profit", loc="left")
    a.set_ylabel("Million US$")
    a.legend(loc="upper left", fontsize=7.5)
    a.set_xticks(years[::2])
    for key in PHASES:
        values = [mil(r["phases"][key]["economicProfit"]) for r in s2]
        b.plot(years, values, color=STAGE_COLORS[key], linewidth=2, label=LABELS[key])
        b.text(years[-1] + 0.25, values[-1], LABELS[key], va="center", fontsize=7.5, color=INK2)
    b.axhline(0, color=AXIS, linewidth=1)
    b.set_title("(B) Economic profit by stage (median)", loc="left")
    b.set_ylabel("Million US$")
    b.set_xticks(years[::2])
    b.set_xlim(years[0] - 0.3, years[-1] + 2.4)
    b.legend(loc="upper left", fontsize=7, ncol=2)
    save(fig, "fig4-s2-historical.png")


# Figure 4: sensitivity tornado, cohort vs rolling entry.
def figure4():
    fig, axes = plt.subplots(1, 2, figsize=(7.4, 3.2), sharey=True, gridspec_kw={"wspace": 0.16})
    order = [d["label"] for d in R["s1Rolling"]["sensitivity"]]
    for ax, key, title in [
        (axes[0], "s1", "(A) Single cohort (S1)"),
        (axes[1], "s1Rolling", "(B) Rolling monthly entry (S1b)"),
    ]:
        data = {d["label"]: d for d in R[key]["sensitivity"]}
        base = mil(R[key]["sensitivityBase"])
        y = list(range(len(order)))[::-1]
        for yi, label in zip(y, order):
            d = data[label]
            low = mil(d["lowEconomicProfit"]) - base
            high = mil(d["highEconomicProfit"]) - base
            ax.barh(yi, low, height=0.32, color=ORANGE, align="edge", zorder=2)
            ax.barh(yi - 0.34, high, height=0.32, color=BLUE, align="edge", zorder=2)
        ax.axvline(0, color=INK2, linewidth=1)
        ax.set_yticks([yi - 0.01 for yi in y], order)
        ax.grid(axis="y", visible=False)
        ax.set_title(title, loc="left")
        ax.set_xlabel(f"Change in chain profit, million US$\n(deterministic base ${base:,.1f}M)")
    axes[0].set_xlim(-60, 60)
    axes[1].set_xlim(-20, 20)
    handles = [plt.Rectangle((0, 0), 1, 1, color=ORANGE), plt.Rectangle((0, 0), 1, 1, color=BLUE)]
    fig.legend(handles, ["Input 10% lower", "Input 10% higher"], loc="upper center",
               ncol=2, fontsize=8, bbox_to_anchor=(0.55, 1.04))
    save(fig, "fig6-sensitivity-tornado.png")


# Figure 5: S3 stage-level vs chain-level risk under alternative correlations.
def figure5():
    cases = [
        (R["s3"][0], "ρ = 0"),
        (R["s1"], "ρ = 0.65 (baseline)"),
        (R["s3"][1], "ρ = 0.95"),
    ]
    groups = PHASES + ["chain"]
    names = [LABELS[k] for k in PHASES] + ["Whole chain"]
    fig, ax = plt.subplots(figsize=(6.8, 3.2))
    width = 0.26
    for i, (row, label) in enumerate(cases):
        widths = []
        for key in groups:
            src = row["chain"] if key == "chain" else row["phases"][key]
            widths.append(mil(src["p90"] - src["p10"]))
        xs = [g + (i - 1) * (width + 0.02) for g in range(len(groups))]
        ax.bar(xs, widths, width=width, color=RHO_RAMP[i], label=label, zorder=2)
    ax.set_xticks(range(len(groups)), names)
    ax.grid(axis="x", visible=False)
    ax.set_ylabel("P10–P90 profit range, million US$")
    ax.legend(title="Common-factor price correlation", fontsize=7.5, title_fontsize=7.5, ncol=3,
              loc="upper left")
    ax.set_ylim(0, 115)
    save(fig, "fig5-s3-risk-correlation.png")


figure1()
figure2()
figure3()
figure4()
figure5()
print("figures written to", OUT)
