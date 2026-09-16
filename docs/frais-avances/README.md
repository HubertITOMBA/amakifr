# Frais avancés — documentation versionnée

| Version | Date | Contenu |
|---------|------|---------|
| 0.2.0-decision | 2026-09-15 | Décision VALIDEE/REJETEE (lot 2 local, flag off) |
| 0.1.6-archive-privee | 2026-09-15 | Archive privée locale ; politique réelle non activée |
| 0.1.5-pg-submit-delete-races | 2026-09-15 | Courses 6a/6b déterministes soumission/suppression |
| 0.1.4-pg-integration | 2026-09-15 | Tests PG allowlistés + injection client + courses |
| 0.1.3-rgpd-hardening | 2026-09-15 | to_regclass hors TX ; Restrict schéma ; course MOVE/UNLINK |
| 0.1.2-rgpd-hook | 2026-09-15 | Hook suppression compte atomique |
| 0.1.1-étape1-socle | 2026-09-15 | Correctifs revue |
| 0.1.0-étape1-socle | 2026-09-15 | Socle local |

Voir [GUIDE.md](./GUIDE.md) et [CHANGELOG.md](./CHANGELOG.md).

**Pas de migration créée/appliquée.** Flag off par défaut.
**Politique de conservation** : à valider par le trésorier — sans elle, refus de suppression si notes SOUMISE|VALIDEE|REJETEE.
**Archive** : privée, non anonyme.
**Décision** ≠ reconnaissance de charge ≠ décaissement ≠ `Depense`.
