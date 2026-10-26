create or replace TRIGGER "BI_ETAT_AVIS"   
  before insert on "DEMANDE_CLARIFICATION"               
  for each row  
begin   
  if :NEW."ID_AVIS" is null then 
    select "ETAT_AVIS_SEQ".nextval into :NEW."ID_AVIS" from sys.dual; 
  end if; 
end;�
/
create or replace TRIGGER "BIU_HEUR_SPP" 
BEFORE INSERT OR UPDATE
ON HEUR_SPP
FOR EACH ROW
DECLARE
    v_min_debut NUMBER;
    v_min_fin   NUMBER;
    v_minutes   NUMBER;
BEGIN
    -- ==========================================
    -- 1. CALCUL DU NOMBRE D'HEURES (Pas de 0.5)
    -- ==========================================
    IF :NEW.DEBUT IS NOT NULL AND :NEW.FIN IS NOT NULL THEN
        -- Conversion du format texte 'HH:MI' en minutes totales depuis minuit
        v_min_debut := TO_NUMBER(SUBSTR(:NEW.DEBUT, 1, 2)) * 60 + TO_NUMBER(SUBSTR(:NEW.DEBUT, 4, 2));
        v_min_fin   := TO_NUMBER(SUBSTR(:NEW.FIN, 1, 2)) * 60 + TO_NUMBER(SUBSTR(:NEW.FIN, 4, 2));
        
        -- Calcul de la différence en minutes
        v_minutes := v_min_fin - v_min_debut;

        -- Gestion du passage à minuit (ex: de 22:00 à 02:00 le lendemain)
        IF v_minutes < 0 THEN
            v_minutes := v_minutes + (24 * 60);
        END IF;

        -- Arrondi précis à la demi-heure la plus proche (0.5)
        :NEW.NBR_H := ROUND((v_minutes / 60) * 2) / 2;
    END IF;

    -- ==========================================
    -- 2. CALCUL DE LA PÉRIODE RH (Du 22 au 21)
    -- ==========================================
    IF :NEW.DATE_J IS NOT NULL THEN
        IF EXTRACT(DAY FROM :NEW.DATE_J) >= 22 THEN
            :NEW.PERIODE_RH := TO_CHAR(ADD_MONTHS(:NEW.DATE_J, 1), 'MM/YYYY');
        ELSE
            :NEW.PERIODE_RH := TO_CHAR(:NEW.DATE_J, 'MM/YYYY');
        END IF;
    END IF;
END;
/
create or replace trigger "CC_BU_STATUS"

BEFORE INSERT OR UPDATE OF DATE_DE_LANC, DATE_OUVERTURE_DES_PLIS, STATUS ON CC
FOR EACH ROW
DECLARE
  v_sp_date SP."تاريخ_قرار__لجنة_الصفقات"%TYPE;
BEGIN
  -- Règle 1 : DATE_DE_LANC => STATUS 2
  IF :NEW.DATE_DE_LANC IS NOT NULL
     AND :NEW.DATE_DE_LANC < SYSDATE
     AND NVL(:NEW.STATUS, 0) < 2
  THEN
     :NEW.STATUS := 2;
  END IF;

  -- Règle 2 : DATE_OUVERTURE_DES_PLIS => STATUS 3
  IF :NEW.DATE_OUVERTURE_DES_PLIS IS NOT NULL
     AND :NEW.DATE_OUVERTURE_DES_PLIS < SYSDATE
     AND NVL(:NEW.STATUS, 0) < 3
  THEN
     :NEW.STATUS := 3;
  END IF;

  -- Règle 3 : date dans SP => STATUS 4
  BEGIN
    SELECT s."تاريخ_قرار__لجنة_الصفقات"
      INTO v_sp_date
      FROM SP s
     WHERE s.ID = :NEW.ID;   -- adapte si la FK est s.cc_id = :NEW.id

    IF v_sp_date IS NOT NULL
       AND v_sp_date < SYSDATE
       AND NVL(:NEW.STATUS, 0) < 4
    THEN
       :NEW.STATUS := 4;
    END IF;

  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      NULL; -- si SP n’existe pas encore pour ce CC, on ne change rien
  END;
END;
/
create or replace trigger "CONTRATS_T"
-- ============================================================
-- 2. TRIGGER : mise à jour instantanée à chaque modification
--    (complément du job planifié)
-- ============================================================

BEFORE INSERT OR UPDATE ON CONTRATS
FOR EACH ROW
BEGIN
    :NEW.ETAT := CASE
     WHEN :NEW.DATE_RESILIATION IS NOT NULL
             AND :NEW.DATE_RESILIATION < SYSDATE
        THEN 'Résilié'


        WHEN :NEW.DATE_FIN_DU_MARCHÉ IS NOT NULL
             AND :NEW.DATE_FIN_DU_MARCHÉ < SYSDATE
        THEN 'Clôturé'

        WHEN :NEW.DATE_DE_MISE_VIGUEUR IS NOT NULL
             AND :NEW.DATE_DE_MISE_VIGUEUR <= SYSDATE
             AND (:NEW.DATE_FIN_DU_MARCHÉ IS NULL
                  OR :NEW.DATE_FIN_DU_MARCHÉ >= SYSDATE)
        THEN 'En exécution'

        WHEN :NEW.DATE_GARANTIE_FINALE IS NOT NULL
        THEN 'Cautionnement Définitif reçue'

        WHEN :NEW.DATE_RETOUR_ENREGISTRE IS NOT NULL
        THEN 'Contrat enregistré'

        WHEN :NEW.DATE_ENVOI_CLIENT_ENREGISTREMENT IS NOT NULL
        THEN 'Enregistrement en cours'

        WHEN :NEW.DATE_RETOUR_ADMIN_SIGNE IS NOT NULL
        THEN 'Signé par administration'

        WHEN :NEW.DATE_ENVOI_ADMIN_SIGNATURE IS NOT NULL
        THEN 'En attente signature administration'

        WHEN :NEW.DATE_RETOUR_CLIENT_SIGNE IS NOT NULL
        THEN 'Signé par titulaire'

        WHEN :NEW.DATE_ENVOI_CLIENT_SIGNATURE IS NOT NULL
        THEN 'En attente signature titulaire'

        WHEN :NEW.DATE_AVIS_JURIDIQUE IS NOT NULL
        THEN 'Avis juridique reçu'

        WHEN :NEW.DATE_LIVRAISON_JURIDIQUE IS NOT NULL
        THEN 'En cours avis juridique'

        ELSE 'Nouveau / Non traité'
    END;
END;
/
create or replace TRIGGER "ETAT_AVIS_T"
before
insert or update or delete on "DEMANDE_CLARIFICATION"
for each row
begin
    null;
end;�;
/
create or replace TRIGGER FACTURES_T 
BEFORE INSERT OR UPDATE ON FACTURES 
FOR EACH ROW 
BEGIN 
 
    -- a) Calcul automatique MONTANT_TTC 
    IF :NEW.MONTANT_TTC IS NULL 
       AND :NEW.MONTANT_HT IS NOT NULL 
    THEN 
        :NEW.MONTANT_TTC := :NEW.MONTANT_HT + NVL(:NEW.MONTANT_TVA, 0); 
    END IF; 
 
    -- a) Calcul automatique MONTANT_TVA (si HT et TTC connus mais pas TVA) 
    IF :NEW.MONTANT_TVA IS NULL 
       AND :NEW.MONTANT_HT  IS NOT NULL 
       AND :NEW.MONTANT_TTC IS NOT NULL 
    THEN 
        :NEW.MONTANT_TVA := :NEW.MONTANT_TTC - :NEW.MONTANT_HT; 
    END IF; 
 
    -- b) Statut "Payée" : dès qu'une date de paiement est saisie 
    IF :NEW.DATE_PAIEMENT IS NOT NULL 
       AND NVL(:NEW.STATUT, 'Reçue') != 'Rejetée' 
    THEN 
        :NEW.STATUT := 'Payée'; 
 
    -- b) Statut "Validée" : date de validation saisie, pas encore payée 
    ELSIF :NEW.DATE_VALIDATION IS NOT NULL 
       AND :NEW.DATE_PAIEMENT IS NULL 
       AND NVL(:NEW.STATUT, 'Reçue') NOT IN ('Rejetée', 'Payée') 
    THEN 
        :NEW.STATUT := 'Validée'; 
    END IF; 
 
    -- c) Horodatage 
    :NEW.DATE_MAJ := SYSDATE; 
    :NEW.MAJ_PAR  := NVL( 
        SYS_CONTEXT('APEX$SESSION','APP_USER'), 
        SYS_CONTEXT('USERENV','SESSION_USER') 
    ); 
 
END;
/
create or replace TRIGGER TRG_AUDIT_CC
AFTER INSERT OR UPDATE OR DELETE ON CC
FOR EACH ROW
DECLARE
    v_action VARCHAR2(10);
    v_record_id VARCHAR2(100);
    v_old_clob CLOB := '{'; -- On ouvre l'accolade tout de suite
    v_new_clob CLOB := '{';
    v_user_audit VARCHAR2(100);
    v_comma VARCHAR2(2) := ''; -- Sert à gérer la virgule entre les champs
    
    -- Fonction locale pour échapper les guillemets
    FUNCTION SAFE_TXT(p_input VARCHAR2) RETURN VARCHAR2 IS
    BEGIN
        RETURN REPLACE(p_input, '"', '\"');
    END;

    -- Procédure locale pour comparer et ajouter si changé
    PROCEDURE CHECK_CHANGE(p_col_name VARCHAR2, p_old_val VARCHAR2, p_new_val VARCHAR2) IS
    BEGIN
        -- On compare les valeurs (en gérant les NULLs correctement)
        IF (p_old_val <> p_new_val) 
           OR (p_old_val IS NULL AND p_new_val IS NOT NULL) 
           OR (p_old_val IS NOT NULL AND p_new_val IS NULL) THEN
           
            -- Ajout à l'ancien JSON
            v_old_clob := v_old_clob || v_comma || '"' || p_col_name || '": "' || SAFE_TXT(p_old_val) || '"';
            -- Ajout au nouveau JSON
            v_new_clob := v_new_clob || v_comma || '"' || p_col_name || '": "' || SAFE_TXT(p_new_val) || '"';
            
            -- Après le premier ajout, le séparateur devient une virgule
            v_comma := ', '; 
        END IF;
    END;

BEGIN
    -- 0. RECUPERATION UTILISATEUR
    v_user_audit := COALESCE(V('P0_USER'), USER);

    -- 1. INITIALISATION
    IF INSERTING THEN
        v_action := 'INSERT';
        v_record_id := :NEW.ID;
    ELSIF UPDATING THEN
        v_action := 'UPDATE';
        v_record_id := :NEW.ID;
    ELSIF DELETING THEN
        v_action := 'DELETE';
        v_record_id := :OLD.ID;
    END IF;

    -- 2. TRAITEMENT SELON L'ACTION
    
    -------------------------------------------------------
    -- CAS UPDATE : ON NE GARDE QUE CE QUI CHANGE
    -------------------------------------------------------
    IF UPDATING THEN
        -- On appelle la procédure pour chaque champ (Code plus propre)
        -- Note : On convertit tout en CHAR pour la comparaison simplifiée
        
        CHECK_CHANGE('REF_AO', :OLD.REF_AO, :NEW.REF_AO);
        CHECK_CHANGE('OBJET_CCT', :OLD.OBJET_CCT, :NEW.OBJET_CCT);
       
        CHECK_CHANGE('BUDGET', TO_CHAR(:OLD.BUDGET), TO_CHAR(:NEW.BUDGET));
        CHECK_CHANGE('DÉTAIL_DE_RÉPONSE', :OLD.DÉTAIL_DE_RÉPONSE, :NEW.DÉTAIL_DE_RÉPONSE);
        CHECK_CHANGE('NATURE_DE_DEPENSE', :OLD.NATURE_DE_DEPENSE, :NEW.NATURE_DE_DEPENSE);
        
        -- Pour les dates, on compare les chaînes formatées
        CHECK_CHANGE('DATE_LIMITE_PROPOSÉE', TO_CHAR(:OLD.DATE_LIMITE_PROPOSÉE, 'YYYY-MM-DD'), TO_CHAR(:NEW.DATE_LIMITE_PROPOSÉE, 'YYYY-MM-DD'));
        CHECK_CHANGE('DATE_DE_LANC', TO_CHAR(:OLD.DATE_DE_LANC, 'YYYY-MM-DD'), TO_CHAR(:NEW.DATE_DE_LANC, 'YYYY-MM-DD'));
        
        CHECK_CHANGE('PV_CCT', :OLD.PV_CCT, :NEW.PV_CCT);

        CHECK_CHANGE('JOURS_REST', TO_CHAR(:OLD.JOURS_REST), TO_CHAR(:NEW.JOURS_REST));
        CHECK_CHANGE('DATE_OUVERTURE', TO_CHAR(:OLD.DATE_OUVERTURE_DES_PLIS, 'YYYY-MM-DD'), TO_CHAR(:NEW.DATE_OUVERTURE_DES_PLIS, 'YYYY-MM-DD'));
        CHECK_CHANGE('STATUS', :OLD.STATUS, :NEW.STATUS);
        
        -- Si v_comma est vide, c'est qu'aucune modification n'a été détectée
        -- Optionnel : on peut décider de ne rien insérer si rien n'a changé
        IF v_comma = '' THEN
            RETURN; -- On arrête tout, pas d'insertion dans les logs
        END IF;

    -------------------------------------------------------
    -- CAS INSERT / DELETE : ON GARDE TOUT (Snapshot)
    -------------------------------------------------------
    ELSE
        -- Pour simplifier, je remets la construction manuelle ici pour Insert/Delete
        -- car CHECK_CHANGE compare old/new, or ici l'un des deux est vide.
        
        -- Astuce : Pour INSERT, on boucle sur NEW. Pour DELETE, sur OLD.
        DECLARE
            -- On utilise des pointeurs pour éviter de dupliquer le code
            v_ref_ao VARCHAR2(4000); v_objet VARCHAR2(4000); -- etc...
            -- Simplification : On construit le bloc directement
        BEGIN
             -- (Pour garder le code lisible ici, je réutilise la méthode concaténation directe du code précédent
             -- mais adaptée pour remplir v_new_clob OU v_old_clob selon le cas)
             
             IF INSERTING THEN
                 v_new_clob := '{' || 
                    '"ID": "' || :NEW.ID || '", ' ||
                    '"REF_AO": "' || SAFE_TXT(:NEW.REF_AO) || '", ' ||
                    '"OBJET_CCT": "' || SAFE_TXT(:NEW.OBJET_CCT) || '", ' ||
                    '"STATUS": "' || SAFE_TXT(:NEW.STATUS) || '", ' ||
                    -- ... (Ajoutez ici les autres champs si vous voulez le snapshot complet à la création)
                    '"CREER_PAR": "' || SAFE_TXT(:NEW.CREER_PAR) || '"'; -- Pas de virgule à la fin
             ELSIF DELETING THEN
                 v_old_clob := '{' || 
                    '"ID": "' || :OLD.ID || '", ' ||
                    '"REF_AO": "' || SAFE_TXT(:OLD.REF_AO) || '", ' ||
                    '"OBJET_CCT": "' || SAFE_TXT(:OLD.OBJET_CCT) || '", ' ||
                    '"STATUS": "' || SAFE_TXT(:OLD.STATUS) || '"'; 
             END IF;
        END;
    END IF;

    -- Fermeture du JSON
    v_old_clob := v_old_clob || '}';
    v_new_clob := v_new_clob || '}';

    -- 3. INSERTION FINALE
    INSERT INTO AUDIT_LOG (
        TABLE_NAME, ACTION_TYPE, RECORD_ID, OLD_VALUE, NEW_VALUE, CHANGED_BY
    ) VALUES (
        'CC', v_action, v_record_id, v_old_clob, v_new_clob, v_user_audit
    );

END;
/
create or replace TRIGGER TRG_AUDIT_SP
AFTER INSERT OR UPDATE OR DELETE ON SP
FOR EACH ROW
DECLARE
    v_action VARCHAR2(10);
    v_record_id VARCHAR2(100);
    v_old_clob CLOB := '{'; 
    v_new_clob CLOB := '{';
    v_user_audit VARCHAR2(100);
    v_comma VARCHAR2(2) := ''; 
    
    -- Fonction pour échapper les guillemets dans le texte (JSON safe)
    FUNCTION SAFE_TXT(p_input VARCHAR2) RETURN VARCHAR2 IS
    BEGIN
        RETURN REPLACE(p_input, '"', '\"');
    END;

    -- Procédure de comparaison (Delta Log)
    PROCEDURE CHECK_CHANGE(p_col_name VARCHAR2, p_old_val VARCHAR2, p_new_val VARCHAR2) IS
    BEGIN
        -- Comparaison gérant les NULLs
        IF (p_old_val <> p_new_val) 
           OR (p_old_val IS NULL AND p_new_val IS NOT NULL) 
           OR (p_old_val IS NOT NULL AND p_new_val IS NULL) THEN
           
            -- Construction du JSON (Clé : Valeur)
            v_old_clob := v_old_clob || v_comma || '"' || p_col_name || '": "' || SAFE_TXT(p_old_val) || '"';
            v_new_clob := v_new_clob || v_comma || '"' || p_col_name || '": "' || SAFE_TXT(p_new_val) || '"';
            
            v_comma := ', '; 
        END IF;
    END;

BEGIN
    -- 0. RECUPERATION UTILISATEUR APEX
    v_user_audit := COALESCE(V('P0_USER'), USER);

    -- 1. INITIALISATION
    IF INSERTING THEN
        v_action := 'INSERT';
        v_record_id := :NEW.ID;
    ELSIF UPDATING THEN
        v_action := 'UPDATE';
        v_record_id := :NEW.ID;
    ELSIF DELETING THEN
        v_action := 'DELETE';
        v_record_id := :OLD.ID;
    END IF;

    -- 2. TRAITEMENT DES MODIFICATIONS (UPDATE)
    IF UPDATING THEN
        -- Champs Textes et Nombres (Attention aux guillemets pour les champs arabes)
        CHECK_CHANGE('عدد', :OLD."عدد", :NEW."عدد");
        CHECK_CHANGE('طريقة_ابرام_الصفقة', :OLD."طريقة_ابرام_الصفقة", :NEW."طريقة_ابرام_الصفقة");
        CHECK_CHANGE('نوعية_الطلب', :OLD."نوعية_الطلب", :NEW."نوعية_الطلب");
        CHECK_CHANGE('اللجنة_المختصة', :OLD."اللجنة_المختصة", :NEW."اللجنة_المختصة");
        CHECK_CHANGE('المكلف_بالملف', :OLD."المكلف_بالملف", :NEW."المكلف_بالملف");

        -- Champs Dates (Conversion obligatoire en YYYY-MM-DD pour comparaison fiable)
        CHECK_CHANGE('تاريخ_ورود_CPT_ممضاة', TO_CHAR(:OLD."تاريخ_ورود_CPT_ممضاة", 'YYYY-MM-DD'), TO_CHAR(:NEW."تاريخ_ورود_CPT_ممضاة", 'YYYY-MM-DD'));
        CHECK_CHANGE('تاريخ_ارسال_مقترح', TO_CHAR(:OLD."تاريخ_ارسال_مقترح_تركيبة_لجنة_التقييم", 'YYYY-MM-DD'), TO_CHAR(:NEW."تاريخ_ارسال_مقترح_تركيبة_لجنة_التقييم", 'YYYY-MM-DD'));
        CHECK_CHANGE('تاريخ_ورود_تعيين', TO_CHAR(:OLD."تاريخ_ورود_تعيين_تركيبة_لجنة_التقييم", 'YYYY-MM-DD'), TO_CHAR(:NEW."تاريخ_ورود_تعيين_تركيبة_لجنة_التقييم", 'YYYY-MM-DD'));
        CHECK_CHANGE('تاريخ_تقديم_كراسات', TO_CHAR(:OLD."تاريخ_تقديم_كراسات_الشروط_للمصادقة", 'YYYY-MM-DD'), TO_CHAR(:NEW."تاريخ_تقديم_كراسات_الشروط_للمصادقة", 'YYYY-MM-DD'));
        CHECK_CHANGE('تاريخ_مصادقة_اللجنة', TO_CHAR(:OLD."تاريخ_مصادقة_اللجنة_على_كراسات_الشروط", 'YYYY-MM-DD'), TO_CHAR(:NEW."تاريخ_مصادقة_اللجنة_على_كراسات_الشروط", 'YYYY-MM-DD'));
        CHECK_CHANGE('تاريخ_ورود_محضر', TO_CHAR(:OLD."تاريخ_ورود_محضر_مصادقة_اللجنة_على_كراسات_الشروط", 'YYYY-MM-DD'), TO_CHAR(:NEW."تاريخ_ورود_محضر_مصادقة_اللجنة_على_كراسات_الشروط", 'YYYY-MM-DD'));
        CHECK_CHANGE('تاريخ_ارجاع_كراسات', TO_CHAR(:OLD."تاريخ_ارجاع_كراسات_الشروط_حسب_المحضر", 'YYYY-MM-DD'), TO_CHAR(:NEW."تاريخ_ارجاع_كراسات_الشروط_حسب_المحضر", 'YYYY-MM-DD'));
        CHECK_CHANGE('تاريخ_ورود_محضر_2', TO_CHAR(:OLD."تاريخ_ورود_محضر_مصادقة_اللجنة_على_كراسات_الشروط2", 'YYYY-MM-DD'), TO_CHAR(:NEW."تاريخ_ورود_محضر_مصادقة_اللجنة_على_كراسات_الشروط2", 'YYYY-MM-DD'));
        CHECK_CHANGE('التاريخ_للإعلان', TO_CHAR(:OLD."التاريخ__للإعلان_عن_المنافسة", 'YYYY-MM-DD'), TO_CHAR(:NEW."التاريخ__للإعلان_عن_المنافسة", 'YYYY-MM-DD'));
       
        CHECK_CHANGE('تاريخ_ارسال_التقرير', TO_CHAR(:OLD."تاريخ_ارسال_التقرير_للتقييم_الفني", 'YYYY-MM-DD'), TO_CHAR(:NEW."تاريخ_ارسال_التقرير_للتقييم_الفني", 'YYYY-MM-DD'));
        CHECK_CHANGE('تاريخ_امضاء_التقرير', TO_CHAR(:OLD."تاريخ_امضاء_تقرير_تقييم_العروض", 'YYYY-MM-DD'), TO_CHAR(:NEW."تاريخ_امضاء_تقرير_تقييم_العروض", 'YYYY-MM-DD'));
        CHECK_CHANGE('تاريخ_تقديم_الملف', TO_CHAR(:OLD."تاريخ_تقديم_الملف_للجنة_الشراءات", 'YYYY-MM-DD'), TO_CHAR(:NEW."تاريخ_تقديم_الملف_للجنة_الشراءات", 'YYYY-MM-DD'));
        CHECK_CHANGE('تاريخ_لجنة_الصفقات', TO_CHAR(:OLD."تاريخ__لجنة_الصفقات", 'YYYY-MM-DD'), TO_CHAR(:NEW."تاريخ__لجنة_الصفقات", 'YYYY-MM-DD'));
        CHECK_CHANGE('تاريخ_قرار_اللجنة', TO_CHAR(:OLD."تاريخ_قرار__لجنة_الصفقات", 'YYYY-MM-DD'), TO_CHAR(:NEW."تاريخ_قرار__لجنة_الصفقات", 'YYYY-MM-DD'));
        CHECK_CHANGE('تاريخ_نشر_النتائج', TO_CHAR(:OLD."تاريخ_نشر_نتائج_المنافسة", 'YYYY-MM-DD'), TO_CHAR(:NEW."تاريخ_نشر_نتائج_المنافسة", 'YYYY-MM-DD'));
        CHECK_CHANGE('تاريخ_تبليغ_الصفقة', TO_CHAR(:OLD."تاريخ_تبليغ_الصفقة", 'YYYY-MM-DD'), TO_CHAR(:NEW."تاريخ_تبليغ_الصفقة", 'YYYY-MM-DD'));
        CHECK_CHANGE('تاريخ_ارجاع_الضمانات', TO_CHAR(:OLD."تاريخ_ارجاع_الضمانات_الوقتية", 'YYYY-MM-DD'), TO_CHAR(:NEW."تاريخ_ارجاع_الضمانات_الوقتية", 'YYYY-MM-DD'));

        -- Si rien n'a changé, on sort sans rien insérer
        IF v_comma = '' THEN
            RETURN; 
        END IF;

    -- 3. CAS INSERTION OU SUPPRESSION (SNAPSHOT PARTIEL)
    ELSE
        DECLARE
            -- Pour simplifier, on prend juste les infos clés pour identifier la ligne
            -- Vous pouvez ajouter plus de champs si nécessaire
        BEGIN
             IF INSERTING THEN
                 v_new_clob := '{' || 
                    '"ID": "' || :NEW.ID || '", ' ||
                    '"عدد": "' || SAFE_TXT(:NEW."عدد") || '", ';
             ELSIF DELETING THEN
                 v_old_clob := '{' || 
                    '"ID": "' || :OLD.ID || '", ' ||
                    '"عدد": "' || SAFE_TXT(:OLD."عدد") || '", ';
             END IF;
        END;
    END IF;

    -- Fermeture JSON
    v_old_clob := v_old_clob || '}';
    v_new_clob := v_new_clob || '}';

    -- 4. INSERTION BASE DE DONNEES
    INSERT INTO AUDIT_LOG (
        TABLE_NAME, ACTION_TYPE, RECORD_ID, OLD_VALUE, NEW_VALUE, CHANGED_BY
    ) VALUES (
        'SP', v_action, v_record_id, v_old_clob, v_new_clob, v_user_audit
    );

END;
/
create or replace TRIGGER TRG_SUIVI_CONTRATS_BI 
    BEFORE INSERT ON SUIVI_CONTRATS 
    FOR EACH ROW 
BEGIN 
    IF :NEW.ID_CONTRAT IS NULL THEN 
        :NEW.ID_CONTRAT := SUIVI_CONTRATS_SEQ.NEXTVAL; 
    END IF; 
END;
/
create or replace TRIGGER TRG_SUIVI_CONTRATS_BU 
    BEFORE UPDATE ON SUIVI_CONTRATS 
    FOR EACH ROW 
BEGIN 
    :NEW.UPDATED_AT := SYSDATE; 
END;
/
create or replace TRIGGER user_notes_bu
BEFORE UPDATE ON user_notes
FOR EACH ROW
BEGIN
  :NEW.LAST_UPDATED := SYSDATE;
END;
/ 