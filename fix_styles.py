import re

with open("frontend/src/app/dashboard/razon-negocio/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Make a backup
with open("frontend/src/app/dashboard/razon-negocio/page.tsx.bak", "w", encoding="utf-8") as f:
    f.write(content)

# 1. Outer `<div className="space-y-6 text-white">`
content = content.replace(
    '<div className="space-y-6 text-white">',
    '<div className="space-y-6 text-slate-900">'
)

# 2. Section boxes `rounded-3xl border border-white/10 bg-white/5 ... shadow-black/20`
content = content.replace(
    'rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20',
    'rounded-3xl border border-slate-200 bg-white p-5 shadow-lg'
)

# 3. Label texts from emerald-300 to emerald-600
content = content.replace('text-emerald-300', 'text-emerald-600')
# Note: header had emerald-300, we should restore it specifically if needed, but in light theme the header background is dark, so text-emerald-300 was actually OK there.
# Let's fix that back.
content = content.replace(
    '<p className="text-xs uppercase tracking-[0.35em] text-emerald-600">Razón de negocio</p>',
    '<p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Razón de negocio</p>'
)

# 4. Text colors for headings and general text
content = content.replace('<h2 className="text-lg font-semibold text-white">', '<h2 className="text-lg font-semibold text-slate-900">')
content = content.replace('<h3 className="text-lg font-semibold text-white">', '<h3 className="text-lg font-semibold text-slate-900">')
content = content.replace('<span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-100">', '<span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">')
content = content.replace('text-sm text-slate-300', 'text-sm text-slate-500')
content = content.replace('text-xs text-slate-300', 'text-xs text-slate-500')

# 5. Contrato Select Button
content = content.replace('border-emerald-300/60 bg-emerald-500/10 text-white', 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm')
content = content.replace('border-white/10 bg-white/5 text-slate-200 hover:border-emerald-300/40', 'border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-300 hover:bg-slate-100')
content = content.replace('text-[11px] text-emerald-200', 'text-[11px] font-medium text-emerald-600')

# 6. Alertas / Info boxes
content = content.replace('border-emerald-300/40 bg-emerald-900/30 px-4 py-3 text-sm text-emerald-100', 'border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800')
content = content.replace('border-white/10 bg-white/10 px-4 py-3 text-sm text-slate-100', 'border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700')
content = content.replace('<span className="font-semibold text-white">', '<span className="font-semibold text-slate-900">')
content = content.replace('border-flame-300/60 bg-flame-900/40 px-4 py-3 text-sm text-flame-50', 'border-flame-200 bg-flame-50 px-4 py-3 text-sm text-flame-800')

# 7. Form inputs (labels + inputs)
content = content.replace('text-xs font-semibold uppercase tracking-wide text-slate-200', 'text-xs font-semibold uppercase tracking-wide text-slate-500')
input_class = 'mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-300 focus:outline-none'
new_input_class = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-400 placeholder-slate-400'
content = content.replace(input_class, new_input_class)

# 8. Tables
content = content.replace('divide-white/10 text-sm text-slate-100', 'divide-slate-200 text-sm text-slate-700')
content = content.replace('text-xs uppercase tracking-wide text-slate-300', 'text-xs uppercase tracking-wide text-slate-500')
content = content.replace('divide-y divide-white/10', 'divide-y divide-slate-100')
content = content.replace('text-slate-100', 'text-slate-800')
content = content.replace('text-slate-200', 'text-slate-600')
content = content.replace('text-emerald-200 hover:text-emerald-100', 'text-emerald-600 hover:text-emerald-700 font-medium')
content = content.replace('text-slate-400', 'text-slate-400') # keep it

with open("frontend/src/app/dashboard/razon-negocio/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)

