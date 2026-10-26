create or replace FUNCTION f_authenticate_user (
    p_username IN VARCHAR2,
    p_password IN VARCHAR2
) RETURN BOOLEAN IS
    v_count NUMBER;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM T_USER
    WHERE MATRICULE = TO_NUMBER(p_username)
      AND MDP = p_password;  -- ⚠️ Idéalement, utilisez un hash (ex: SHA256)

    RETURN v_count > 0;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END f_authenticate_user;
/
create or replace FUNCTION f_login_redirect RETURN VARCHAR2 AS
    v_groupe T_USER.GROUPE%TYPE;
BEGIN
    SELECT GROUPE
    INTO v_groupe
    FROM T_USER
    WHERE MATRICULE = TO_NUMBER(V('APP_USER'));

    IF v_groupe IN ('ADMINISTRATOR', 'CONTRIBUTOR') THEN
        RETURN APEX_PAGE.GET_URL(p_page => 44);
    ELSIF v_groupe = 'READER' THEN
        RETURN APEX_PAGE.GET_URL(p_page => 1);
    ELSE
        RETURN APEX_PAGE.GET_URL(p_page => 9999);
    END IF;

EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RETURN APEX_PAGE.GET_URL(p_page => 9999);
END f_login_redirect;
/
create or replace function "K"
return varchar2
as
begin


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


end "K";
/
create or replace FUNCTION "LIBRARY_F" (p_username IN VARCHAR2,p_password IN VARCHAR2)
RETURN BOOLEAN IS
BEGIN
FOR c1 IN (SELECT 1 FROM T_USER
WHERE UPPER(MATRICULE) = UPPER(p_username) AND UPPER(MDP) = UPPER(p_password))    
LOOP
RETURN TRUE;
END LOOP;
RETURN FALSE;

end;
/ 