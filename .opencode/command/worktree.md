---
description: Crea un git worktree en .worktrees/<nombre> a partir del contexto proporcionado
---

Crea un git worktree local sin cambiar de directorio ni hacer nada extra.

Input del usuario: `$ARGUMENTS`

## Instrucciones

1. **Generar `<nombre-de-worktree>`:**
   - Si `$ARGUMENTS` contiene texto, úsalo como base para el nombre. Slugifica: minúsculas, `a-z0-9-`, reemplaza espacios/underscores por `-`, elimina caracteres especiales, colapsa `--` a `-`, recorta guiones al inicio/final, máximo 50 caracteres.
   - Si `$ARGUMENTS` está vacío, deriva el nombre del último contexto/conversación visible (tema, tarea o feature mencionada). Aplica las mismas reglas de slug.
   - Si no hay contexto suficiente, usa `worktree-$(date +%Y%m%d-%H%M)` como fallback (genera fecha con bash `date +%Y%m%d-%H%M`).
   - El nombre debe ser kebab-case. Ejemplos: `fix-colisiones`, `feature-nivel-dificil`, `refactor-hud`.

2. **Crear el worktree:**
   - Ejecuta SOLO este comando vía bash tool (no cambies de directorio, no hagas `cd`, no instales dependencias, no hagas commit):
     ```bash
     git worktree add .worktrees/<nombre-de-worktree> -b <nombre-de-worktree>
     ```
   - Si la rama ya existe y el comando con `-b` falla, reintenta sin `-b`:
     ```bash
     git worktree add .worktrees/<nombre-de-worktree>
     ```
   - No uses `cd .worktrees/<nombre>` ni ningún otro comando posterior.

3. **Reportar:**
   - Indica el comando exacto ejecutado, la ruta creada `.worktrees/<nombre>` y el output de git.
   - Si el directorio/rama ya existe, informa el error y sugiere un nombre alternativo.

Restricciones: NO cambies de directorio, NO hagas checkout adicional, NO modifiques archivos, NO ejecutes nada más que el `git worktree add`.
