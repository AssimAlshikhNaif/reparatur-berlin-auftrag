import os, re

SRC = "/app/frontend/src"
# Ordered replacements (longer/more specific first)
REPL = [
    ("hover:bg-accent hover:text-white", "hover:bg-blue-600 hover:text-primary-foreground"),
    ("bg-white text-black", "bg-primary text-primary-foreground"),
    ("hover:text-white", "hover:text-primary-foreground"),
    ("text-white", "text-foreground"),
    ("text-zinc-100", "text-foreground"),
    ("text-zinc-200", "text-foreground"),
    ("text-zinc-300", "text-foreground/80"),
    ("text-zinc-400", "text-muted-foreground"),
    ("text-zinc-500", "text-muted-foreground"),
    ("text-zinc-600", "text-muted-foreground/70"),
    ("hover:bg-zinc-900", "hover:bg-muted"),
    ("hover:bg-zinc-800", "hover:bg-muted"),
    ("bg-zinc-950", "bg-background"),
    ("bg-zinc-900", "bg-card"),
    ("bg-zinc-800", "bg-muted"),
    ("bg-black/95", "bg-background/95"),
    ("bg-black/90", "bg-background/90"),
    ("bg-black/80", "bg-background/80"),
    ("bg-black/60", "bg-background/70"),
    ("bg-black/40", "bg-card/60"),
    ("border-zinc-600", "border-border"),
    ("border-zinc-700", "border-border"),
    ("rounded-none", "rounded-lg"),
]

# Files to skip (no class churn needed / must stay literal)
SKIP = {"index.css", "index.js", "api.js", "constants.js", "datetime.js", "AuthContext.jsx"}

changed = []
for root, _, files in os.walk(SRC):
    if "/components/ui" in root:
        continue
    for fn in files:
        if not (fn.endswith(".jsx") or fn.endswith(".js")):
            continue
        if fn in SKIP:
            continue
        p = os.path.join(root, fn)
        with open(p) as f:
            txt = f.read()
        orig = txt
        for a, b in REPL:
            txt = txt.replace(a, b)
        if txt != orig:
            with open(p, "w") as f:
                f.write(txt)
            changed.append(fn)
print("Changed:", changed)
