create or replace PROCEDURE CLEANUP_EXPIRED_REMINDERS AS
BEGIN
    DELETE FROM USER_NOTES WHERE 
        -- التنبيهات التي فات موعد التنبيه الفعلي
        REMINDER_DATETIME - (NVL(PRE_REMINDER_MINS,0)/1440) < SYSDATE - 1  -- يوم كامل بعد التنبيه
        AND IS_SENT = 'Y';  -- تم إرسالها فقط
        
    COMMIT;
    
    
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END;
/
create or replace PROCEDURE ctrl_cc_rappels_custom (
  p_app_id IN NUMBER DEFAULT 105  -- Remplacez 100 par votre APP_ID
) AS
  CURSOR c_cc IS
    SELECT DISTINCT REF_AO
    FROM cc
    WHERE status = 5
    AND NOT EXISTS (
      SELECT 1 FROM CUSTOM_NOTIFICATIONS 
      WHERE ref_ao = cc.REF_AO
    );
    
  l_users SYS.DBMS_SQL.VARCHAR2_TABLE;
  l_user VARCHAR2(255);
BEGIN
 /* SELECT username BULK COLLECT INTO l_users
  FROM apex_acl_user_roles u
  WHERE EXISTS (
    SELECT 1 FROM apex_acl_roles r 
    WHERE r.application_id = p_app_id
    AND r.static_id IN ('CONTRIBUTOR', 'ADMINISTRATOR')
    AND u.role_static_id = r.static_id
    AND u.application_id = r.application_id
  );
  */
  FOR rec IN c_cc LOOP
    FOR i IN 1..l_users.COUNT LOOP
      l_user := l_users(i);
      
      INSERT INTO CUSTOM_NOTIFICATIONS (ref_ao, username, title, body, app_id)
      VALUES (rec.REF_AO, l_user, 'Rappel CC Status 5', 
              'Vérifiez la référence CC ' || rec.REF_AO || ' (status=5).',
              p_app_id);
    END LOOP;
  END LOOP;
  
  COMMIT;
END;
/
create or replace procedure "LINK_IMPORT"
as
begin
-- إنشاء جدول لتخزين الروابط


-- إجراء PL/SQL لاستخراج الروابط من جميع السنوات الدراسية
DECLARE
    v_years SYS.ODCIVARCHAR2LIST := SYS.ODCIVARCHAR2LIST(
        '1ere-annee','2eme-annee','3eme-annee',
        '4eme-annee','5eme-annee','6eme-annee'
    );
    v_url        VARCHAR2(500);
    v_http_req   UTL_HTTP.req;
    v_http_resp  UTL_HTTP.resp;
    v_line       VARCHAR2(32767);
    v_match      VARCHAR2(500);
BEGIN
    FOR i IN 1..v_years.COUNT LOOP
        v_url := 'https://www.primaireprivee.tn/' || v_years(i);

        v_http_req := UTL_HTTP.begin_request(v_url);
        v_http_resp := UTL_HTTP.get_response(v_http_req);

        LOOP
            BEGIN
                UTL_HTTP.read_line(v_http_resp, v_line, TRUE);

                -- استخراج الروابط التي تنتهي بـ PDF أو DOCX أو PPTX
                v_match := REGEXP_SUBSTR(v_line, 'href="([^"]+\.(pdf|docx|pptx))"', 1, 1, NULL, 1);

                IF v_match IS NOT NULL THEN
                    INSERT INTO site_files (year_level, file_name, download_url)
                    VALUES (v_years(i), 'ملف تعليمي', v_match);
                END IF;

            EXCEPTION
                WHEN UTL_HTTP.end_of_body THEN
                    EXIT;
            END;
        END LOOP;

        UTL_HTTP.end_response(v_http_resp);
    END LOOP;

    COMMIT;
END;


end "LINK_IMPORT";
/
create or replace PROCEDURE p_post_auth AS
    v_nom    T_USER.NOM%TYPE;
    v_groupe T_USER.GROUPE%TYPE;
    v_id     T_USER.ID_1%TYPE;
BEGIN
    SELECT ID_1, NOM, GROUPE
    INTO v_id, v_nom, v_groupe
    FROM T_USER
    WHERE MATRICULE = TO_NUMBER(V('APP_USER'));

    -- Stocker les infos en session uniquement
    APEX_UTIL.SET_SESSION_STATE('APP_NOM',    v_nom);
    APEX_UTIL.SET_SESSION_STATE('APP_GROUPE', v_groupe);
    APEX_UTIL.SET_SESSION_STATE('APP_ID',     TO_CHAR(v_id));

EXCEPTION
    WHEN NO_DATA_FOUND THEN NULL;
END p_post_auth;
/
create or replace PROCEDURE PROCESS_REMINDERS_TO_SEND AS
    -- تعريف الوقت الحالي
    v_target_time DATE := SYSDATE; 

BEGIN
    -- 1. تحديد وتحديث الملاحظات التي يجب تنبيه المستخدم بها الآن
    -- نحن نريد معالجة جميع التنبيهات التي فات وقتها ولم يتم إرسالها بعد.
    
    UPDATE USER_NOTES n
    SET n.IS_SENT = 'Y'
    WHERE n.IS_SENT = 'N'
      -- هذا الشرط وحده كافٍ: متى ما فات وقت التنبيه الفعلي (حتى لو فات بساعات)
      AND n.REMINDER_DATETIME - (n.PRE_REMINDER_MINS / 1440) <= v_target_time; 
      
      -- **تم حذف الشرط المقيِّد:**
      -- -- AND n.REMINDER_DATETIME >= v_target_time - (1/1440);

    COMMIT;
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END PROCESS_REMINDERS_TO_SEND;
/
create or replace PROCEDURE SP_ALERTES_FACTURES AS 
 
    -- Destinataire des alertes (à adapter) 
    c_email_dest    CONSTANT VARCHAR2(200) := 'gestion.contrats@votre-societe.tn'; 
    c_email_from    CONSTANT VARCHAR2(200) := 'apex-noreply@votre-societe.tn'; 
    c_seuil_alerte  CONSTANT NUMBER        := 30;   -- jours depuis validation 
    c_seuil_warning CONSTANT NUMBER        := 15; 
 
    v_corps         CLOB; 
    v_nb_retard     NUMBER := 0; 
    v_nb_warning    NUMBER := 0; 
 
    CURSOR c_retards IS 
        SELECT 
            N_CONTRAT_BC, 
            TITULAIRE_DU_MARCHÉ, 
            N_FACTURE, 
            TO_CHAR(DATE_VALIDATION,  'DD/MM/YYYY') AS DT_VALID, 
            MONTANT_TTC, 
            DEVISE, 
            JOURS_DEPUIS_VALIDATION, 
            INDICATEUR_RETARD, 
            RESPONSABLE 
        FROM V_FACTURES 
        WHERE INDICATEUR_RETARD IN ('RETARD', 'ATTENTION') 
          AND STATUT IN ('Validée', 'En attente validation') 
        ORDER BY JOURS_DEPUIS_VALIDATION DESC NULLS LAST; 
 
BEGIN 
 
    -- Construction du corps HTML de l'e-mail 
    v_corps := '<html><body style="font-family:Arial,sans-serif;font-size:13px;">' 
            || '<h2 style="color:#185FA5;">Alertes Factures en attente de paiement</h2>' 
            || '<p>Date du rapport : <b>' || TO_CHAR(SYSDATE,'DD/MM/YYYY HH24:MI') || '</b></p>' 
            || '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;">' 
            || '<thead style="background:#E6F1FB;">' 
            || '<tr>' 
            || '<th>Contrat</th><th>Titulaire</th><th>N° Facture</th>' 
            || '<th>Montant TTC</th><th>Validée le</th><th>Jours écoulés</th>' 
            || '<th>Responsable</th><th>Niveau</th>' 
            || '</tr></thead><tbody>'; 
 
    FOR r IN c_retards LOOP 
 
        IF r.INDICATEUR_RETARD = 'RETARD' THEN 
            v_nb_retard := v_nb_retard + 1; 
        ELSE 
            v_nb_warning := v_nb_warning + 1; 
        END IF; 
 
        v_corps := v_corps 
            || '<tr style="background:' 
            || CASE r.INDICATEUR_RETARD 
                   WHEN 'RETARD'    THEN '#FCEBEB' 
                   WHEN 'ATTENTION' THEN '#FAEEDA' 
                   ELSE '#FFFFFF' 
               END || ';">' 
            || '<td>' || r.N_CONTRAT_BC         || '</td>' 
            || '<td>' || r.TITULAIRE_DU_MARCHÉ  || '</td>' 
            || '<td>' || r.N_FACTURE            || '</td>' 
            || '<td style="text-align:right;">' 
            ||     TO_CHAR(r.MONTANT_TTC, 'FM999G999G990D000') || ' ' || r.DEVISE 
            || '</td>' 
            || '<td>' || r.DT_VALID             || '</td>' 
            || '<td style="text-align:center;font-weight:bold;">' 
            ||     r.JOURS_DEPUIS_VALIDATION || ' j' 
            || '</td>' 
            || '<td>' || NVL(r.RESPONSABLE, '-') || '</td>' 
            || '<td style="font-weight:bold;color:' 
            ||     CASE r.INDICATEUR_RETARD 
                       WHEN 'RETARD'    THEN '#A32D2D' 
                       WHEN 'ATTENTION' THEN '#BA7517' 
                   END || ';">' 
            ||     r.INDICATEUR_RETARD 
            || '</td>' 
            || '</tr>'; 
 
    END LOOP; 
 
    v_corps := v_corps 
            || '</tbody></table>' 
            || '<p style="margin-top:16px;">' 
            || '<b>' || v_nb_retard  || '</b> facture(s) en <span style="color:#A32D2D;">RETARD</span> (&gt;' 
            || c_seuil_alerte || ' j) &nbsp;|&nbsp; ' 
            || '<b>' || v_nb_warning || '</b> facture(s) en <span style="color:#BA7517;">ATTENTION</span> (' 
            || c_seuil_warning || '-' || c_seuil_alerte || ' j)' 
            || '</p>' 
            || '</body></html>'; 
 
    -- Envoi uniquement s'il y a des factures en retard ou en attention 
    IF v_nb_retard + v_nb_warning > 0 THEN 
        APEX_MAIL.SEND( 
            p_to        => c_email_dest, 
            p_from      => c_email_from, 
            p_subj      => '[CONTRATS] ' || (v_nb_retard + v_nb_warning) 
                           || ' facture(s) en attente de paiement — ' 
                           || TO_CHAR(SYSDATE,'DD/MM/YYYY'), 
            p_body      => 'Veuillez consulter la version HTML de cet e-mail.', 
            p_body_html => v_corps 
        ); 
        APEX_MAIL.PUSH_QUEUE; 
    END IF; 
 
    DBMS_OUTPUT.PUT_LINE( 
        'Alertes envoyées : ' || v_nb_retard || ' retard(s), ' 
        || v_nb_warning || ' attention(s).' 
    ); 
 
EXCEPTION 
    WHEN OTHERS THEN 
        DBMS_OUTPUT.PUT_LINE('Erreur SP_ALERTES_FACTURES : ' || SQLERRM); 
END SP_ALERTES_FACTURES;
/
create or replace procedure "UPDATE_CC_STATUS_BATCH"
IS
  CURSOR c_cc IS
    SELECT c.id, c.date_de_lanc, c.date_ouverture_des_plis, c.status,
           s."تاريخ_قرار__لجنة_الصفقات" as sp_date
      FROM cc c
      LEFT JOIN sp s ON (s.id = c.id)  -- relation 1-1
     WHERE c.status < 4;  -- optim : ne traiter que les status < 4
BEGIN
  FOR rec IN c_cc LOOP
    -- Règle 1 : DATE_DE_LANC passée → status 2
    IF rec.date_de_lanc IS NOT NULL 
       AND rec.date_de_lanc < SYSDATE 
       AND rec.status < 2
    THEN
      UPDATE cc 
         SET status = 2 
       WHERE id = rec.id;
    -- Règle 2 : DATE_OUVERTURE_DES_PLIS passée → status 3  
    ELSIF rec.date_ouverture_des_plis IS NOT NULL 
          AND rec.date_ouverture_des_plis < SYSDATE 
          AND rec.status < 3
    THEN
      UPDATE cc 
         SET status = 3 
       WHERE id = rec.id;
    -- Règle 3 : SP date passée → status 4
    ELSIF rec.sp_date IS NOT NULL 
          AND rec.sp_date < SYSDATE 
          AND rec.status < 4
    THEN
      UPDATE cc 
         SET status = 4 
       WHERE id = rec.id;
    END IF;
  END LOOP;
  
  COMMIT;  -- important pour batch
EXCEPTION
  WHEN OTHERS THEN
    ROLLBACK;
    RAISE_APPLICATION_ERROR(-20001, 'Erreur batch CC status: ' || SQLERRM);
END;
/ 