-- Migration C: notes_frais_4x_integrity
-- Index partiels uniques + CHECK/XOR documentés (schema.prisma / GUIDE).
-- Triggers différés complexes (MIXTE enfants exacts, corrections Σ inverses) :
--   REPORTÉS — exactitude non démontrée ici par tests dédiés de migration ;
--   gardes applicatives TX + tests PG restent la source de vérité jusqu''à une
--   migration ultérieure dédiée avec tests de triggers.

-- ========== Preflights ==========

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "notes_frais_choix_reglement"
    WHERE statut = 'ACTIF'
    GROUP BY "noteFraisId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL notes_frais_4x_integrity: doublons choix ACTIF par noteFraisId';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "notes_frais_reglement_annulation_demandes"
    WHERE statut = 'DEMANDEE' AND "reglementId" IS NOT NULL
    GROUP BY "reglementId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL notes_frais_4x_integrity: doublons DEMANDEE par reglementId';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "notes_frais_reglement_annulation_demandes"
    WHERE statut = 'DEMANDEE' AND "operationId" IS NOT NULL
    GROUP BY "operationId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL notes_frais_4x_integrity: doublons DEMANDEE par operationId';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "notes_frais_reglement_lignes"
    WHERE (
      ("typeLigne" = 'COMPENSATION' AND (
        "typeCible" IS NULL OR "cibleId" IS NULL
        OR "montantRestantCibleAvant" IS NULL OR "montantRestantCibleApres" IS NULL
        OR "montantAutoriseRestantAvant" IS NULL
      ))
      OR
      ("typeLigne" = 'REMBOURSEMENT' AND (
        "typeCible" IS NOT NULL OR "cibleId" IS NOT NULL
        OR "montantRestantCibleAvant" IS NOT NULL OR "montantRestantCibleApres" IS NOT NULL
        OR "montantAutoriseRestantAvant" IS NOT NULL
      ))
    )
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL notes_frais_4x_integrity: lignes règlement XOR/cibles invalides';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "notes_frais_reglements"
    WHERE (
      ("operationId" IS NULL AND "idempotencyKey" IS NULL)
      OR ("operationId" IS NOT NULL AND "idempotencyKey" IS NOT NULL)
    )
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL notes_frais_4x_integrity: reglements idempotency/operationId XOR invalide';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "notes_frais_reglement_annulation_demandes"
    WHERE (("reglementId" IS NULL) = ("operationId" IS NULL))
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL notes_frais_4x_integrity: annulation XOR reglementId/operationId invalide';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "justificatifs_note_frais_archives"
    GROUP BY "archiveId", rang
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL notes_frais_4x_integrity: doublons archiveId+rang';
  END IF;
END $$;

-- MIXTE incomplets : préflight informatif — contrainte agrégée reportée (pas de CHECK simple)
DO $$
BEGIN
  IF EXISTS (
    SELECT o.id
    FROM "notes_frais_reglement_operations" o
    LEFT JOIN "notes_frais_reglements" r ON r."operationId" = o.id
    GROUP BY o.id
    HAVING COUNT(r.id) FILTER (WHERE r.type = 'COMPENSATION') <> 1
        OR COUNT(r.id) FILTER (WHERE r.type = 'REMBOURSEMENT') <> 1
        OR COUNT(r.id) <> 2
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT FAIL notes_frais_4x_integrity: opération MIXTE incomplète (attendu 1 COMPENSATION + 1 REMBOURSEMENT) — corriger manuellement ; trigger différé non créé dans cette migration';
  END IF;
END $$;

-- ========== Index partiels ==========

CREATE UNIQUE INDEX "notes_frais_choix_reglement_actif_uidx"
  ON "notes_frais_choix_reglement" ("noteFraisId")
  WHERE statut = 'ACTIF';

CREATE UNIQUE INDEX "notes_frais_annul_demande_reglement_demandee_uidx"
  ON "notes_frais_reglement_annulation_demandes" ("reglementId")
  WHERE statut = 'DEMANDEE' AND "reglementId" IS NOT NULL;

CREATE UNIQUE INDEX "notes_frais_annul_demande_operation_demandee_uidx"
  ON "notes_frais_reglement_annulation_demandes" ("operationId")
  WHERE statut = 'DEMANDEE' AND "operationId" IS NOT NULL;

-- ========== CHECK / XOR ==========

ALTER TABLE "notes_frais_reglement_lignes"
  ADD CONSTRAINT "notes_frais_reglement_lignes_xor_cible_chk" CHECK (
    (
      "typeLigne" = 'COMPENSATION'
      AND "typeCible" IS NOT NULL
      AND "cibleId" IS NOT NULL
      AND "montantRestantCibleAvant" IS NOT NULL
      AND "montantRestantCibleApres" IS NOT NULL
      AND "montantAutoriseRestantAvant" IS NOT NULL
    )
    OR
    (
      "typeLigne" = 'REMBOURSEMENT'
      AND "typeCible" IS NULL
      AND "cibleId" IS NULL
      AND "montantRestantCibleAvant" IS NULL
      AND "montantRestantCibleApres" IS NULL
      AND "montantAutoriseRestantAvant" IS NULL
    )
  );

ALTER TABLE "notes_frais_reglements"
  ADD CONSTRAINT "notes_frais_reglements_idempotency_xor_chk" CHECK (
    ("operationId" IS NULL AND "idempotencyKey" IS NOT NULL)
    OR ("operationId" IS NOT NULL AND "idempotencyKey" IS NULL)
  );

ALTER TABLE "notes_frais_reglement_annulation_demandes"
  ADD CONSTRAINT "notes_frais_annul_demande_xor_cible_chk" CHECK (
    ("reglementId" IS NOT NULL AND "operationId" IS NULL)
    OR ("reglementId" IS NULL AND "operationId" IS NOT NULL)
  );

-- REPORTÉ (documenté, non créé) :
--   CONSTRAINT TRIGGER différé notes_frais_reglement_operations_mixte_enfants_trg
--     → exactement 1 enfant COMPENSATION + 1 REMBOURSEMENT par opération
--   CONSTRAINT TRIGGER différé notes_frais_correction_inverses_coherence_trg
--     → appartenance ligne↔règlement, type, Σ inverses = abs(montant)
-- Raison : exactitude à démontrer par tests de migration dédiés ; garde TX + PG tests métier.
