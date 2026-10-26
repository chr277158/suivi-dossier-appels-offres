  CREATE OR REPLACE FORCE EDITIONABLE VIEW "AJOUT_CONTRAT" ("ID_C", "ID_CC", "REF_AO", "N_CONTRAT__BC", "TITULAIRE_DU_MARCHÉ", "REF_AO_C", "CADRE__PONCTUEL", "MONTANT", "DEVISE", "OBJET", "ID_CC_C", "DATE_DE_MISE_VIGUEUR") AS 
  select CONTRATS.ID as ID_C,
    CC.ID as ID_CC,
    CC.REF_AO as REF_AO,
    CONTRATS.N_CONTRAT_BC as N_CONTRAT_BC,
    CONTRATS."TITULAIRE_DU_MARCHÉ" as "TITULAIRE_DU_MARCHÉ",
    CONTRATS.REF_AO as REF_AO_C,
    CONTRATS.CADRE__PONCTUEL as CADRE__PONCTUEL,
    CONTRATS.MONTANT as MONTANT,
    CONTRATS.DEVISE as DEVISE,
    CONTRATS.OBJET as OBJET,
    CONTRATS.ID_CC as ID_CC_C,
    CONTRATS.DATE_DE_MISE_VIGUEUR as DATE_DE_MISE_VIGUEUR 
 from CONTRATS CONTRATS,
    CC CC 
 where CONTRATS.ID_CC(+) =CC.ID
    and CONTRATS.ID_CC=CC.REF_AO
    and CC.REF_AO=CONTRATS.REF_AO(+);

  CREATE OR REPLACE FORCE EDITIONABLE VIEW "AJOUT_NOTE" ("ID_NOTE", "ANNE_NOTE", "NUM_NOTE", "CODE", "DATE_MEV", "OBSERVATION", "SECRETERIAT", "CODREG", "ETAT", "DATECR", "DATEMJ", "USER_MAJ", "ID_MEMBRE", "ANNEE_NOTE", "NUM_NOT", "MATEMP", "FONCTION", "TITRE", "DATEC", "DATEM", "USER_MA") AS 
  select NOTE_COMMISSION.ID_NOTE as ID_NOTE,
    NOTE_COMMISSION.ANNEE_NOTE as ANNE_NOTE,
    NOTE_COMMISSION.NUM_NOTE as NUM_NOTE,
    NOTE_COMMISSION.CODE as CODE,
    NOTE_COMMISSION.DATE_MEV as DATE_MEV,
    NOTE_COMMISSION.OBSERVATION as OBSERVATION,
    NOTE_COMMISSION.SECRETERIAT as SECRETERIAT,
    NOTE_COMMISSION.CODREG as CODREG,
    NOTE_COMMISSION.ETAT as ETAT,
    NOTE_COMMISSION.DATECR as DATECR,
    NOTE_COMMISSION.DATEMJ as DATEMJ,
    NOTE_COMMISSION.USER_MAJ as USER_MAJ,
    MEMBRE.ID_MEMBRE as ID_MEMBRE,
    MEMBRE.ANNEE_NOTE as ANNEE_NOTE,
    MEMBRE.NUM_NOTE as NUM_NOT,
    MEMBRE.MATEMP as MATEMP,
    MEMBRE.FONCTION as FONCTION,
    MEMBRE.TITRE as TITRE,
    MEMBRE.DATECR as DATEC,
    MEMBRE.DATEMJ as DATEM,
    MEMBRE.USER_MAJ as USER_MA 
 from MEMBRE MEMBRE,
    NOTE_COMMISSION NOTE_COMMISSION 
 where NOTE_COMMISSION.ID_NOTE=MEMBRE.ID_MEMBRE(+);

  CREATE OR REPLACE FORCE EDITIONABLE VIEW "CC_SP_COMPLET" ("ID", "ID_CC", "ID_C", "REF_AO", "OBJET_CCT", "BUDGET", "DÉTAIL_DE_RÉPONSE", "NATURE_DE_DEPENSE", "DATE_LIMITE_PROPOSÉE", "DATE_DE_LANC", "DATE_CRÉATION", "ID_S", "عدد", "طريقة_ابرام_الصفقة", "نوعية_الطلب", "اللجنة_المختصة", "P", "VID1", "VID2", "VID", "تاريخ_ورود_CPT_ممضاة", "تاريخ_ارسال_مقترح_تركيبة_لجنة_التقييم", "تاريخ_ورود_تعيين_تركيبة_لجنة_التقييم", "تاريخ_تقديم_كراسات_الشروط_للمصادقة", "تاريخ_مصادقة_اللجنة_على_كراسات_الشروط", "تاريخ_ورود_محضر_مصادقة_اللجنة_على_كراسات_الشروط", "تاريخ_ارجاع_كراسات_الشروط_حسب_المحضر", "تاريخ_ورود_محضر_مصادقة_اللجنة_على_كراسات_الشروط2", "التاريخ__للإعلان_عن_المنافسة", "تاريخ_ارسال_التقرير_للتقييم_الفني", "تاريخ_امضاء_تقرير_تقييم_العروض", "تاريخ_تقديم_الملف_للجنة_الشراءات", "تاريخ__لجنة_الصفقات", "تاريخ_قرار__لجنة_الصفقات", "تاريخ_نشر_نتائج_المنافسة", "تاريخ_تبليغ_الصفقة", "تاريخ_ارجاع_الضمانات_الوقتية", "linkh", "المكلف_بالملف") AS 
  select 
  fl.ID,
  fl.ID_CC,
  CC.ID as ID_c,
    CC.REF_AO as REF_AO,
    CC.OBJET_CCT as OBJET_CCT,
   
    CC.BUDGET as BUDGET,
    CC."DÉTAIL_DE_RÉPONSE" as "DÉTAIL_DE_RÉPONSE",
    CC.NATURE_DE_DEPENSE as NATURE_DE_DEPENSE,
    CC."DATE_LIMITE_PROPOSÉE" as "DATE_LIMITE_PROPOSÉE",
    CC.DATE_DE_LANC as DATE_DE_LANC,
    CC.DATE_CRÉATION as DATE_CRÉATION,
    
    SP.ID as ID_s,
    SP."عدد" as "عدد",
    SP."طريقة_ابرام_الصفقة" as "طريقة_ابرام_الصفقة",
    SP."نوعية_الطلب" as "نوعية_الطلب",
    SP."اللجنة_المختصة" as "اللجنة_المختصة",
    case when SP."اللجنة_المختصة" = 'CRA' then 40 else 4 end as P,
    case when SP."اللجنة_المختصة" = 'CRA' then 'P40_ID_1' else 'P4_ID_1' end as VID1,
    case when SP."اللجنة_المختصة" = 'CRA' then 'P40_ID_2' else 'P4_ID_2' end as VID2,
    case when SP."اللجنة_المختصة" = 'CRA' then 'P40_ID' else 'P4_ID' end as VID,
    SP."تاريخ_ورود_CPT_ممضاة" as "تاريخ_ورود_CPT_ممضاة",
    
    SP."تاريخ_ارسال_مقترح_تركيبة_لجنة_التقييم" as "تاريخ_ارسال_مقترح_تركيبة_لجنة_التقييم",
    SP."تاريخ_ورود_تعيين_تركيبة_لجنة_التقييم" as "تاريخ_ورود_تعيين_تركيبة_لجنة_التقييم",
    SP."تاريخ_تقديم_كراسات_الشروط_للمصادقة" as "تاريخ_تقديم_كراسات_الشروط_للمصادقة",
    SP."تاريخ_مصادقة_اللجنة_على_كراسات_الشروط" as "تاريخ_مصادقة_اللجنة_على_كراسات_الشروط",
    SP."تاريخ_ورود_محضر_مصادقة_اللجنة_على_كراسات_الشروط" as "تاريخ_ورود_محضر_مصادقة_اللجنة_على_كراسات_الشروط",
    SP."تاريخ_ارجاع_كراسات_الشروط_حسب_المحضر" as "تاريخ_ارجاع_كراسات_الشروط_حسب_المحضر",
    SP."تاريخ_ورود_محضر_مصادقة_اللجنة_على_كراسات_الشروط2" as "تاريخ_ورود_محضر_مصادقة_اللجنة_على_كراسات_الشروط2",
    SP."التاريخ__للإعلان_عن_المنافسة" as "التاريخ__للإعلان_عن_المنافسة",
    SP."تاريخ_ارسال_التقرير_للتقييم_الفني" as "تاريخ_ارسال_التقرير_للتقييم_الفني",
    SP."تاريخ_امضاء_تقرير_تقييم_العروض" as "تاريخ_امضاء_تقرير_تقييم_العروض",
    SP."تاريخ_تقديم_الملف_للجنة_الشراءات" as "تاريخ_تقديم_الملف_للجنة_الشراءات",
    SP."تاريخ__لجنة_الصفقات" as "تاريخ__لجنة_الصفقات",
    SP."تاريخ_قرار__لجنة_الصفقات" as "تاريخ_قرار__لجنة_الصفقات",
    SP."تاريخ_نشر_نتائج_المنافسة" as "تاريخ_نشر_نتائج_المنافسة",
    SP."تاريخ_تبليغ_الصفقة" as "تاريخ_تبليغ_الصفقة",
    SP."تاريخ_ارجاع_الضمانات_الوقتية" as "تاريخ_ارجاع_الضمانات_الوقتية",
    DECODE(NVL(SP."اللجنة_المختصة", 'Y'),
       'CRA', 'f?p=105:40:' || V('APP_SESSION') || '::P40_ID,P40_ID_1,P40_ID_2:' || fl.ID || ',' || CC.ID || ',' || CC.ID,
              'f?p=105:4:'  || V('APP_SESSION') || '::P4_ID,P4_ID_1,P4_ID_2:'  || fl.ID || ',' || CC.ID || ',' || CC.ID
) AS linkh,
    SP."المكلف_بالملف" as "المكلف_بالملف" 

    FROM FICHIER_LNCEMENT fl
JOIN CC cc ON fl.ID_CC = CC.ID
JOIN SP SP ON sp.ID = CC.ID
 where CC.ID=SP.ID;

  CREATE OR REPLACE FORCE EDITIONABLE VIEW "CC_SP_FL" ("ID", "REF_AO", "OBJET_CCT", "BUDGET", "طريقة_ابرام_الصفقة", "نوعية_الطلب", "اللجنة_المختصة", "NATURE_DE_DEPENSE", "DÉTAIL_DE_RÉPONSE", "DATE_CRÉATION", "تاريخ_تقديم_كراسات_الشروط_للمصادقة", "تاريخ_مصادقة_اللجنة_على_كراسات_الشروط", "التاريخ__للإعلان_عن_المنافسة", "DATE_LIMITE_PROPOSÉE", "DATE_OUVERTURE_DES_PLIS", "تاريخ_قرار__لجنة_الصفقات", "STATUS", "تاريخ_ارجاع_الضمانات_الوقتية", "المكلف_بالملف", "P", "VID1", "VID2", "VID") AS 
  select CC.ID as ID,
    CC.REF_AO as REF_AO,
    CC.OBJET_CCT as OBJET_CCT,
    CC.BUDGET as BUDGET,
    SP."طريقة_ابرام_الصفقة" as "طريقة_ابرام_الصفقة",
    SP."نوعية_الطلب" as "نوعية_الطلب",
    SP."اللجنة_المختصة" as "اللجنة_المختصة",
    CC.NATURE_DE_DEPENSE as NATURE_DE_DEPENSE,
    CC."DÉTAIL_DE_RÉPONSE" as "DÉTAIL_DE_RÉPONSE",
    CC."DATE_CRÉATION" as "DATE_CRÉATION",
    SP."تاريخ_تقديم_كراسات_الشروط_للمصادقة" as "تاريخ_تقديم_كراسات_الشروط_للمصادقة",
    SP."تاريخ_مصادقة_اللجنة_على_كراسات_الشروط" as "تاريخ_مصادقة_اللجنة_على_كراسات_الشروط",
    SP."التاريخ__للإعلان_عن_المنافسة" as "التاريخ__للإعلان_عن_المنافسة",
    CC."DATE_LIMITE_PROPOSÉE" as "DATE_LIMITE_PROPOSÉE",
    CC.DATE_OUVERTURE_DES_PLIS as DATE_OUVERTURE_DES_PLIS,
    SP."تاريخ_قرار__لجنة_الصفقات" as "تاريخ_قرار__لجنة_الصفقات",
    CC.STATUS as STATUS,
    SP."تاريخ_ارجاع_الضمانات_الوقتية" as "تاريخ_ارجاع_الضمانات_الوقتية",
    SP."المكلف_بالملف" as "المكلف_بالملف",
     case when SP."اللجنة_المختصة" = 'CRA' then 40 else 4 end as P,
    case when SP."اللجنة_المختصة" = 'CRA' then 'P40_ID_1' else 'P4_ID_1' end as VID1,
    case when SP."اللجنة_المختصة" = 'CRA' then 'P40_ID_2' else 'P4_ID_2' end as VID2,
    case when SP."اللجنة_المختصة" = 'CRA' then 'P40_ID' else 'P4_ID' end as VID 
 from FICHIER_LNCEMENT FICHIER_LNCEMENT,
    SP SP,
    CC CC 
 where CC.ID=SP.ID
    and CC.ID=FICHIER_LNCEMENT.ID_CC;

  CREATE OR REPLACE FORCE EDITIONABLE VIEW "CC_SP_STAT" ("ID", "عدد", "طريقة_ابرام_الصفقة", "نوعية_الطلب", "اللجنة_المختصة", "تاريخ_ورود_CPT_ممضاة", "تاريخ_ارسال_مقترح_تركيبة_لجنة_التقييم", "تاريخ_ورود_تعيين_تركيبة_لجنة_التقييم", "تاريخ_تقديم_كراسات_الشروط_للمصادقة", "تاريخ_مصادقة_اللجنة_على_كراسات_الشروط", "تاريخ_ورود_محضر_مصادقة_اللجنة_على_كراسات_الشروط", "تاريخ_ارجاع_كراسات_الشروط_حسب_المحضر", "تاريخ_ورود_محضر_مصادقة_اللجنة_على_كراسات_الشروط2", "التاريخ__للإعلان_عن_المنافسة", "تاريخ_ارسال_التقرير_للتقييم_الفني", "تاريخ_امضاء_تقرير_تقييم_العروض", "تاريخ_تقديم_الملف_للجنة_الشراءات", "تاريخ__لجنة_الصفقات", "تاريخ_قرار__لجنة_الصفقات", "تاريخ_نشر_نتائج_المنافسة", "REF_AO", "OBJET_CCT", "BUDGET", "DÉTAIL_DE_RÉPONSE", "NATURE_DE_DEPENSE", "DATE_LIMITE_PROPOSÉE", "DATE_DE_LANC", "DATE_OUVERTURE_DES_PLIS", "STATUS", "DATE_CRÉATION", "CREER_PAR") AS 
  select SP_1.ID as ID,
    SP_1."عدد" as "عدد",
    SP_1."طريقة_ابرام_الصفقة" as "طريقة_ابرام_الصفقة",
    SP_1."نوعية_الطلب" as "نوعية_الطلب",
    SP_1."اللجنة_المختصة" as "اللجنة_المختصة",
    SP_1."تاريخ_ورود_CPT_ممضاة" as "تاريخ_ورود_CPT_ممضاة",
    SP_1."تاريخ_ارسال_مقترح_تركيبة_لجنة_التقييم" as "تاريخ_ارسال_مقترح_تركيبة_لجنة_التقييم",
    SP_1."تاريخ_ورود_تعيين_تركيبة_لجنة_التقييم" as "تاريخ_ورود_تعيين_تركيبة_لجنة_التقييم",
    SP_1."تاريخ_تقديم_كراسات_الشروط_للمصادقة" as "تاريخ_تقديم_كراسات_الشروط_للمصادقة",
    SP_1."تاريخ_مصادقة_اللجنة_على_كراسات_الشروط" as "تاريخ_مصادقة_اللجنة_على_كراسات_الشروط",
    SP_1."تاريخ_ورود_محضر_مصادقة_اللجنة_على_كراسات_الشروط" as "تاريخ_ورود_محضر_مصادقة_اللجنة_على_كراسات_الشروط",
    SP_1."تاريخ_ارجاع_كراسات_الشروط_حسب_المحضر" as "تاريخ_ارجاع_كراسات_الشروط_حسب_المحضر",
    SP_1."تاريخ_ورود_محضر_مصادقة_اللجنة_على_كراسات_الشروط2" as "تاريخ_ورود_محضر_مصادقة_اللجنة_على_كراسات_الشروط2",
    SP_1."التاريخ__للإعلان_عن_المنافسة" as "التاريخ__للإعلان_عن_المنافسة",
    SP_1."تاريخ_ارسال_التقرير_للتقييم_الفني" as "تاريخ_ارسال_التقرير_للتقييم_الفني",
    SP_1."تاريخ_امضاء_تقرير_تقييم_العروض" as "تاريخ_امضاء_تقرير_تقييم_العروض",
    SP_1."تاريخ_تقديم_الملف_للجنة_الشراءات" as "تاريخ_تقديم_الملف_للجنة_الشراءات",
    SP_1."تاريخ__لجنة_الصفقات" as "تاريخ__لجنة_الصفقات",
    SP_1."تاريخ_قرار__لجنة_الصفقات" as "تاريخ_قرار__لجنة_الصفقات",
    SP_1."تاريخ_نشر_نتائج_المنافسة" as "تاريخ_نشر_نتائج_المنافسة",
    CC.REF_AO as REF_AO,
    CC.OBJET_CCT as OBJET_CCT,
    CC.BUDGET as BUDGET,
    CC."DÉTAIL_DE_RÉPONSE" as "DÉTAIL_DE_RÉPONSE",
    CC.NATURE_DE_DEPENSE as NATURE_DE_DEPENSE,
    CC."DATE_LIMITE_PROPOSÉE" as "DATE_LIMITE_PROPOSÉE",
    CC.DATE_DE_LANC as DATE_DE_LANC,
    CC.DATE_OUVERTURE_DES_PLIS as DATE_OUVERTURE_DES_PLIS,
    CC.STATUS as STATUS,
    CC."DATE_CRÉATION" as "DATE_CRÉATION",
    CC.CREER_PAR as CREER_PAR 
 from SP SP_1,
  
    CC CC 
 where CC.ID=SP_1.ID;

  CREATE OR REPLACE FORCE EDITIONABLE VIEW "ETAT_CC_COPLETE" ("ID_AE", "REF_AO", "OBJET_CCT", "BUDGET", "DÉTAIL_DE_RÉPONSE", "NATURE_DE_DEPENSE", "DATE_LIMITE_PROPOSÉE", "DATE_DE_LANC", "PV_CCT", "ID_REM", "ID_C", "REF_DOS", "REMARQUE", "ID", "ID_CC", "PROPOSITION_COMMISSION", "DATE_PROPOSITION", "CC_POUR_LANCEMENT", "DATE_CC", "CRITERES_EVALUATION", "DATE_CRITERES", "AVIS_DE_PRESSE", "DATE_AVIS", "DESIGNATION_DE_LA_COMMISSION", "DATE_DESIGNATION", "PROGRAM_LANC", "DATE_PROGRAM_LANC", "CAUTION_P", "DATE_NOTE_OP", "NOTE_OUVERTURE_PLIS", "DATE_PROGRAM_OUVERTURE", "PROGRAMME_OUVERTURE_DE_PLIS", "DATE_MAIL", "MAIL_PRESTATAIRE", "ID_1", "طريقة_ابرام_الصفقة", "نوعية_الطلب", "اللجنة_المختصة", "تاريخ_ورود_CPT_ممضاة", "تاريخ_ارسال_مقترح_تركيبة_لجنة_التقييم", "تاريخ_تقديم_كراسات_الشروط_للمصادقة", "تاريخ_مصادقة_اللجنة_على_كراسات_الشروط", "تاريخ_ورود_محضر_مصادقة_اللجنة_على_كراسات_الشروط", "التاريخ__للإعلان_عن_المنافسة", "تاريخ_ارسال_التقرير_للتقييم_الفني", "تاريخ_قرار__لجنة_الصفقات", "تاريخ__لجنة_الصفقات", "المكلف_بالملف", "STATUS", "CREER_PAR", "تاريخ_تبليغ_الصفقة", "تاريخ_ارجاع_الضمانات_الوقتية", "تاريخ_نشر_نتائج_المنافسة") AS 
  select CC.ID as ID_AE,
    CC.REF_AO as REF_AO,
    CC.OBJET_CCT as OBJET_CCT,
  
    CC.BUDGET as BUDGET,
    CC."DÉTAIL_DE_RÉPONSE" as "DÉTAIL_DE_RÉPONSE",
    CC.NATURE_DE_DEPENSE as NATURE_DE_DEPENSE,
    CC."DATE_LIMITE_PROPOSÉE" as "DATE_LIMITE_PROPOSÉE",
    CC.DATE_DE_LANC as DATE_DE_LANC,
    CC.PV_CCT as PV_CCT,
    REMARQUE.ID_REM as ID_REM,
    REMARQUE.ID_CC as ID_C,
    REMARQUE.REF_DOS as REF_DOS,
    REMARQUE.REMARQUE as REMARQUE,
    FICHIER_LNCEMENT.ID as ID,
    FICHIER_LNCEMENT.ID_CC as ID_CC,
    FICHIER_LNCEMENT.PROPOSITION_COMMISSION as PROPOSITION_COMMISSION,
    FICHIER_LNCEMENT.DATE_PROPOSITION as DATE_PROPOSITION,
    FICHIER_LNCEMENT.CC_POUR_LANCEMENT as CC_POUR_LANCEMENT,
    FICHIER_LNCEMENT.DATE_CC as DATE_CC,
    FICHIER_LNCEMENT.CRITERES_EVALUATION as CRITERES_EVALUATION,
    FICHIER_LNCEMENT.DATE_CRITERES as DATE_CRITERES,
    FICHIER_LNCEMENT.AVIS_DE_PRESSE as AVIS_DE_PRESSE,
    FICHIER_LNCEMENT.DATE_AVIS as DATE_AVIS,
    FICHIER_LNCEMENT.DESIGNATION_DE_LA_COMMISSION as DESIGNATION_DE_LA_COMMISSION,
    FICHIER_LNCEMENT.DATE_DESIGNATION as DATE_DESIGNATION,
    FICHIER_LNCEMENT.PROGRAM_LANC as PROGRAM_LANC,
    FICHIER_LNCEMENT.DATE_PROGRAM_LANC as DATE_PROGRAM_LANC,
    FICHIER_LNCEMENT.CAUTION_P as CAUTION_P,
    FICHIER_LNCEMENT.DATE_NOTE_OP as DATE_NOTE_OP,
    FICHIER_LNCEMENT.NOTE_OUVERTURE_PLIS as NOTE_OUVERTURE_PLIS,
    FICHIER_LNCEMENT.DATE_PROGRAM_OUVERTURE as DATE_PROGRAM_OUVERTURE,
    FICHIER_LNCEMENT.PROGRAMME_OUVERTURE_DE_PLIS as PROGRAMME_OUVERTURE_DE_PLIS,
    FICHIER_LNCEMENT.DATE_MAIL as DATE_MAIL,
    FICHIER_LNCEMENT.MAIL_PRESTATAIRE as MAIL_PRESTATAIRE,
    SP.ID as ID_1,
    SP."طريقة_ابرام_الصفقة" as "طريقة_ابرام_الصفقة",
    SP."نوعية_الطلب" as "نوعية_الطلب",
    SP."اللجنة_المختصة" as "اللجنة_المختصة",
    SP."تاريخ_ورود_CPT_ممضاة" as "تاريخ_ورود_CPT_ممضاة",
    SP."تاريخ_ارسال_مقترح_تركيبة_لجنة_التقييم" as "تاريخ_ارسال_مقترح_تركيبة_لجنة_التقييم",
    SP."تاريخ_تقديم_كراسات_الشروط_للمصادقة" as "تاريخ_تقديم_كراسات_الشروط_للمصادقة",
    SP."تاريخ_مصادقة_اللجنة_على_كراسات_الشروط" as "تاريخ_مصادقة_اللجنة_على_كراسات_الشروط",
    SP."تاريخ_ورود_محضر_مصادقة_اللجنة_على_كراسات_الشروط" as "تاريخ_ورود_محضر_مصادقة_اللجنة_على_كراسات_الشروط",
    SP."التاريخ__للإعلان_عن_المنافسة" as "التاريخ__للإعلان_عن_المنافسة",
    SP."تاريخ_ارسال_التقرير_للتقييم_الفني" as "تاريخ_ارسال_التقرير_للتقييم_الفني",
    SP."تاريخ_قرار__لجنة_الصفقات" as "تاريخ_قرار__لجنة_الصفقات",
    SP."تاريخ__لجنة_الصفقات" as "تاريخ__لجنة_الصفقات",
    SP."المكلف_بالملف" as "المكلف_بالملف",
    CC.STATUS as STATUS,
    CC.CREER_PAR as CREER_PAR,
    SP."تاريخ_تبليغ_الصفقة" as "تاريخ_تبليغ_الصفقة",
    SP."تاريخ_ارجاع_الضمانات_الوقتية" as "تاريخ_ارجاع_الضمانات_الوقتية",
    SP."تاريخ_نشر_نتائج_المنافسة" as "تاريخ_نشر_نتائج_المنافسة" 
 from REMARQUE REMARQUE,
    FICHIER_LNCEMENT FICHIER_LNCEMENT,
    SP SP,
    CC CC 
 where CC.ID=SP.ID
    and CC.ID=FICHIER_LNCEMENT.ID_CC
    and CC.ID=REMARQUE.ID_CC;

  CREATE OR REPLACE FORCE EDITIONABLE VIEW "FICHIER_MANQUANT_PAR_DOSSIER" ("ID", "ID_CC", "Titre", "OBJET", "PROPOSITION_COMMISSION", "PC", "DATE_PROPOSITION", "CC_POUR_LANCEMENT", "CC", "DATE_CC", "CRITERES_EVALUATION", "CE", "DATE_CRITERES", "AVIS_DE_PRESSE", "AP", "DATE_AVIS", "DESIGNATION_DE_LA_COMMISSION", "DC", "DATE_DESIGNATION", "PROGRAM_LANC", "PL", "DATE_PROGRAM_LANC", "MAIL_PRESTATAIRE", "MP", "DATE_MAIL", "PROGRAMME_OUVERTURE_DE_PLIS", "POP", "DATE_PROGRAM_OUVERTURE", "NOTE_OUVERTURE_PLIS", "NOP", "DATE_NOTE_OP", "CAUTION_P", "STATUS", "ST", "STAT", "DATE_DE_LANC", "TEX", "DATE_OUVERTURE_DES_PLIS", "IDS", "CRA", "CRA2", "JOURS", "PROGRESS_COLOR", "BODY_HTML", "linkh", "CP", "المكلف_بالملف") AS 
  SELECT
  fl.ID,
  fl.ID_CC,
CC.REF_AO,
CC.OBJET_CCT,
 fl.PROPOSITION_COMMISSION,
  CASE WHEN fl.PROPOSITION_COMMISSION = 'N'
       THEN 'PROPOSITION DE LA COMMISSION D’EVALUATION'
       ELSE ' '
  END AS PC,
  fl.DATE_PROPOSITION,

  fl.CC_POUR_LANCEMENT,
  CASE WHEN fl.CC_POUR_LANCEMENT = 'N' THEN 'CC POUR LANCEMENT' ELSE ' ' END AS CC,
  fl.DATE_CC,

  fl.CRITERES_EVALUATION,
  CASE WHEN fl.CRITERES_EVALUATION = 'N' THEN 'CRITERES EVALUATION' ELSE ' ' END AS CE,
  fl.DATE_CRITERES,

  fl.AVIS_DE_PRESSE,
  CASE WHEN fl.AVIS_DE_PRESSE = 'N' THEN 'AVIS DE PRESSE' ELSE ' ' END AS AP,
  fl.DATE_AVIS,

  fl.DESIGNATION_DE_LA_COMMISSION,
  CASE WHEN fl.DESIGNATION_DE_LA_COMMISSION = 'N' THEN 'DESIGNATION DE LA COMMISSION' ELSE ' ' END AS DC,
 fl.DATE_DESIGNATION,

  fl.PROGRAM_LANC,
  CASE WHEN fl.PROGRAM_LANC = 'N' THEN 'PROGRAM LANCEMENT' ELSE ' ' END AS PL,
  fl.DATE_PROGRAM_LANC,

  fl.MAIL_PRESTATAIRE,
  CASE WHEN fl.MAIL_PRESTATAIRE = 'N' THEN 'MAIL PRESTATAIRE' ELSE ' ' END AS MP,
  fl.DATE_MAIL,

  fl.PROGRAMME_OUVERTURE_DE_PLIS,
  CASE WHEN fl.PROGRAMME_OUVERTURE_DE_PLIS = 'N' THEN 'PROGRAMME DE LANCEMENT' ELSE ' ' END AS POP,
  fl.DATE_PROGRAM_OUVERTURE,

  fl.NOTE_OUVERTURE_PLIS,
  CASE WHEN fl.NOTE_OUVERTURE_PLIS = 'N' THEN 'NOTE OUVERTURE PLIS' ELSE ' ' END AS NOP,
  fl.DATE_NOTE_OP,
fl.CAUTION_P,
  CC.STATUS,
  CASE
    WHEN CC.STATUS = '1' THEN ' En cours de Préparation '
    WHEN CC.STATUS = '2' THEN ' Appel d''Offres en cour'
    WHEN CC.STATUS = '3' THEN ' En cour d''Évaluation'
    WHEN CC.STATUS = '4' THEN ' Dossier Traité Pensez à modifier le statut de AO pour pouvoir le classer'
    ELSE 'Dossier Classé '
  END AS ST,
  CASE
    WHEN CC.STATUS < '4' and fl.CAUTION_P = 'Y' and   SP."تاريخ_قرار__لجنة_الصفقات" < sysdate + 200
         
    THEN 'Ouverture de plis à été éffectuer Pensez à modifier le statut pour pouvoir le classer '
    ELSE ' '
  END AS STAT,
CC.DATE_DE_LANC,
  CASE
    WHEN CC.DATE_DE_LANC >= SYSDATE
    THEN 'Le lancement de l"appel d"offre est prévu pour le '
    ELSE 'Le lancement de l"appel d"offre été le '
  END AS TEX,

  CC.DATE_OUVERTURE_DES_PLIS,
  SP.ID AS IDS,
  SP."اللجنة_المختصة" AS CRA,
    CASE
    WHEN SP."اللجنة_المختصة" = 'CRA'
    THEN 'CRA'
    ELSE ''
  END AS CRA2,
CASE
    WHEN  CC.DATE_OUVERTURE_DES_PLIS <= SYSDATE and fl.CAUTION_P = 'N'
THEN  TO_CHAR(120 - (SYSDATE - CC.DATE_OUVERTURE_DES_PLIS), 'FM990', 'NLS_NUMERIC_CHARACTERS=''.,''') || ' Jours Restant'
WHEN  CC.DATE_OUVERTURE_DES_PLIS <= SYSDATE and fl.CAUTION_P = 'Y'
THEN  '  ' 
 WHEN  CC.DATE_OUVERTURE_DES_PLIS > SYSDATE and fl.CAUTION_P = 'N'
THEN  TO_CHAR(( CC.DATE_OUVERTURE_DES_PLIS - SYSDATE), 'FM990', 'NLS_NUMERIC_CHARACTERS=''.,''') || ' Jours avant Louverture des Plis' 
WHEN  CC.DATE_OUVERTURE_DES_PLIS > SYSDATE and fl.CAUTION_P = 'Y'
THEN  ' Attention Vous avez rendu les cautions avant Louverture des Plis!!!'
ElSE 

'Date Ouvertue de Plis NON Défini ' END AS JOURS,
CASE 
        WHEN ((SYSDATE - CC.DATE_OUVERTURE_DES_PLIS )) >= 75 THEN 'red'
        ELSE 'blue'
    END AS PROGRESS_COLOR,
    -- calcul BODY_HTML avec TO_CHAR 
    TO_CHAR((SYSDATE - CC.DATE_OUVERTURE_DES_PLIS), 'FM990D99', 'NLS_NUMERIC_CHARACTERS=''.,''') AS BODY_HTML,



    
/* CASE WHEN NVL(SP."اللجنة_المختصة", 'Y') = 'CRA' THEN
  'f?p=105:40:' || V('APP_SESSION') || '::P40_ID,P40_ID_1,P40_ID_2:' || fl.ID_CC || ',' || fl.ID_CC || ',' || fl.ID
ELSE
  'f?p=105:4:' || V('APP_SESSION') || '::P4_ID,P4_ID_1,P4_ID_2:' || fl.ID_CC || ',' || fl.ID_CC || ',' || fl.ID
END as linkh,*/
DECODE(NVL(SP."اللجنة_المختصة", 'Y'),
       'CRA', 'f?p=105:40:' || V('APP_SESSION') || '::P40_ID,P40_ID_1,P40_ID_CCID_2,P40_NB:' || fl.ID_CC || ',' || fl.ID_CC || ',' || fl.ID || ',' || CC.REF_AO,
              'f?p=105:4:'  || V('APP_SESSION') || '::P4_ID,P4_ID_1,P4_ID_2:'  || fl.ID_CC || ',' || fl.ID_CC || ',' || fl.ID
) AS linkh,


 
  CASE WHEN fl.CAUTION_P = 'N' THEN 'REMISE DES CAUTIONS PROVISOIRES' else  ' ' END AS CP,
  
  
  SP."المكلف_بالملف"
FROM FICHIER_LNCEMENT fl
JOIN CC cc ON fl.ID_CC = cc.ID
JOIN SP sp ON sp.ID = cc.ID
WHERE (CC.STATUS <= '4' );

  CREATE OR REPLACE FORCE EDITIONABLE VIEW "INFORMATION_COMPLETE_CC" ("ID_AE", "REF_AO", "OBJET_CCT", "BUDGET", "DÉTAIL_DE_RÉPONSE", "NATURE_DE_DEPENSE", "DATE_LIMITE_PROPOSÉE", "DATE_DE_LANC", "PV_CCT", "ID_REM", "ID_C", "REF_DOS", "REMARQUE", "ID", "ID_CC", "PROPOSITION_COMMISSION", "DATE_PROPOSITION", "CC_POUR_LANCEMENT", "DATE_CC", "CRITERES_EVALUATION", "DATE_CRITERES", "AVIS_DE_PRESSE", "DATE_AVIS", "DESIGNATION_DE_LA_COMMISSION", "DATE_DESIGNATION", "PROGRAM_LANC", "DATE_PROGRAM_LANC", "CAUTION_P", "DATE_NOTE_OP", "NOTE_OUVERTURE_PLIS", "DATE_PROGRAM_OUVERTURE", "PROGRAMME_OUVERTURE_DE_PLIS", "DATE_MAIL", "MAIL_PRESTATAIRE", "ID_1", "طريقة_ابرام_الصفقة", "نوعية_الطلب", "اللجنة_المختصة", "تاريخ_ورود_CPT_ممضاة", "تاريخ_ارسال_مقترح_تركيبة_لجنة_التقييم", "تاريخ_تقديم_كراسات_الشروط_للمصادقة", "تاريخ_مصادقة_اللجنة_على_كراسات_الشروط", "تاريخ_ورود_محضر_مصادقة_اللجنة_على_كراسات_الشروط", "التاريخ__للإعلان_عن_المنافسة", "تاريخ_ارسال_التقرير_للتقييم_الفني", "تاريخ_قرار__لجنة_الصفقات", "تاريخ__لجنة_الصفقات", "المكلف_بالملف", "STATUS", "CREER_PAR", "تاريخ_تبليغ_الصفقة", "تاريخ_ارجاع_الضمانات_الوقتية", "تاريخ_نشر_نتائج_المنافسة") AS 
  select CC.ID as ID_AE,
    CC.REF_AO as REF_AO,
    CC.OBJET_CCT as OBJET_CCT,
   
    CC.BUDGET as BUDGET,
    CC."DÉTAIL_DE_RÉPONSE" as "DÉTAIL_DE_RÉPONSE",
    CC.NATURE_DE_DEPENSE as NATURE_DE_DEPENSE,
    CC."DATE_LIMITE_PROPOSÉE" as "DATE_LIMITE_PROPOSÉE",
    CC.DATE_DE_LANC as DATE_DE_LANC,
    CC.PV_CCT as PV_CCT,
    REMARQUE.ID_REM as ID_REM,
    REMARQUE.ID_CC as ID_C,
    REMARQUE.REF_DOS as REF_DOS,
    REMARQUE.REMARQUE as REMARQUE,
    FICHIER_LNCEMENT.ID as ID,
    FICHIER_LNCEMENT.ID_CC as ID_CC,
    FICHIER_LNCEMENT.PROPOSITION_COMMISSION as PROPOSITION_COMMISSION,
    FICHIER_LNCEMENT.DATE_PROPOSITION as DATE_PROPOSITION,
    FICHIER_LNCEMENT.CC_POUR_LANCEMENT as CC_POUR_LANCEMENT,
    FICHIER_LNCEMENT.DATE_CC as DATE_CC,
    FICHIER_LNCEMENT.CRITERES_EVALUATION as CRITERES_EVALUATION,
    FICHIER_LNCEMENT.DATE_CRITERES as DATE_CRITERES,
    FICHIER_LNCEMENT.AVIS_DE_PRESSE as AVIS_DE_PRESSE,
    FICHIER_LNCEMENT.DATE_AVIS as DATE_AVIS,
    FICHIER_LNCEMENT.DESIGNATION_DE_LA_COMMISSION as DESIGNATION_DE_LA_COMMISSION,
    FICHIER_LNCEMENT.DATE_DESIGNATION as DATE_DESIGNATION,
    FICHIER_LNCEMENT.PROGRAM_LANC as PROGRAM_LANC,
    FICHIER_LNCEMENT.DATE_PROGRAM_LANC as DATE_PROGRAM_LANC,
    FICHIER_LNCEMENT.CAUTION_P as CAUTION_P,
    FICHIER_LNCEMENT.DATE_NOTE_OP as DATE_NOTE_OP,
    FICHIER_LNCEMENT.NOTE_OUVERTURE_PLIS as NOTE_OUVERTURE_PLIS,
    FICHIER_LNCEMENT.DATE_PROGRAM_OUVERTURE as DATE_PROGRAM_OUVERTURE,
    FICHIER_LNCEMENT.PROGRAMME_OUVERTURE_DE_PLIS as PROGRAMME_OUVERTURE_DE_PLIS,
    FICHIER_LNCEMENT.DATE_MAIL as DATE_MAIL,
    FICHIER_LNCEMENT.MAIL_PRESTATAIRE as MAIL_PRESTATAIRE,
    SP.ID as ID_1,
    SP."طريقة_ابرام_الصفقة" as "طريقة_ابرام_الصفقة",
    SP."نوعية_الطلب" as "نوعية_الطلب",
    SP."اللجنة_المختصة" as "اللجنة_المختصة",
    SP."تاريخ_ورود_CPT_ممضاة" as "تاريخ_ورود_CPT_ممضاة",
    SP."تاريخ_ارسال_مقترح_تركيبة_لجنة_التقييم" as "تاريخ_ارسال_مقترح_تركيبة_لجنة_التقييم",
    SP."تاريخ_تقديم_كراسات_الشروط_للمصادقة" as "تاريخ_تقديم_كراسات_الشروط_للمصادقة",
    SP."تاريخ_مصادقة_اللجنة_على_كراسات_الشروط" as "تاريخ_مصادقة_اللجنة_على_كراسات_الشروط",
    SP."تاريخ_ورود_محضر_مصادقة_اللجنة_على_كراسات_الشروط" as "تاريخ_ورود_محضر_مصادقة_اللجنة_على_كراسات_الشروط",
    SP."التاريخ__للإعلان_عن_المنافسة" as "التاريخ__للإعلان_عن_المنافسة",
    SP."تاريخ_ارسال_التقرير_للتقييم_الفني" as "تاريخ_ارسال_التقرير_للتقييم_الفني",
    SP."تاريخ_قرار__لجنة_الصفقات" as "تاريخ_قرار__لجنة_الصفقات",
    SP."تاريخ__لجنة_الصفقات" as "تاريخ__لجنة_الصفقات",
    SP."المكلف_بالملف" as "المكلف_بالملف",
    CC.STATUS as STATUS,
    CC.CREER_PAR as CREER_PAR,
    SP."تاريخ_تبليغ_الصفقة" as "تاريخ_تبليغ_الصفقة",
    SP."تاريخ_ارجاع_الضمانات_الوقتية" as "تاريخ_ارجاع_الضمانات_الوقتية",
    SP."تاريخ_نشر_نتائج_المنافسة" as "تاريخ_نشر_نتائج_المنافسة" 
 from REMARQUE REMARQUE,
    FICHIER_LNCEMENT FICHIER_LNCEMENT,
    SP SP,
    CC CC 
 where CC.ID=SP.ID
    and CC.ID=FICHIER_LNCEMENT.ID_CC
    and CC.ID=REMARQUE.ID_CC;

  CREATE OR REPLACE FORCE EDITIONABLE VIEW "M" ("LOG_ID", "TABLE_NAME", "ACTION_TYPE", "RECORD_ID", "OLD_VALUE", "NEW_VALUE", "CHANGED_BY", "CHANGED_DATE", "IDC", "REF_AO", "IDS", "عدد") AS 
  select AUDIT_LOG.LOG_ID as LOG_ID,
    AUDIT_LOG.TABLE_NAME as TABLE_NAME,
    AUDIT_LOG.ACTION_TYPE as ACTION_TYPE,
    AUDIT_LOG.RECORD_ID as RECORD_ID,
    AUDIT_LOG.OLD_VALUE as OLD_VALUE,
    AUDIT_LOG.NEW_VALUE as NEW_VALUE,
    AUDIT_LOG.CHANGED_BY as CHANGED_BY,
    AUDIT_LOG.CHANGED_DATE as CHANGED_DATE,
    CC.ID as IDc,
    CC.REF_AO as REF_AO,
    SP.ID as IDs,
    SP."عدد" as "عدد" 
 from SP,
    AUDIT_LOG,
    CC 
 where SP.ID=AUDIT_LOG.RECORD_ID
    and CC.ID=AUDIT_LOG.RECORD_ID;

  CREATE OR REPLACE FORCE EDITIONABLE VIEW "MOD" ("LOG_ID", "TABLE_NAME", "ACTION_TYPE", "RECORD_ID", "OLD_VALUE", "NEW_VALUE", "CHANGED_BY", "CHANGED_DATE", "IDC", "REF_AO", "عدد", "IDS") AS 
  select  AUDIT_LOG.LOG_ID as LOG_ID,
    AUDIT_LOG.TABLE_NAME as TABLE_NAME,
    AUDIT_LOG.ACTION_TYPE as ACTION_TYPE,
    AUDIT_LOG.RECORD_ID as RECORD_ID,
    AUDIT_LOG.OLD_VALUE as OLD_VALUE,
    AUDIT_LOG.NEW_VALUE as NEW_VALUE,
    AUDIT_LOG.CHANGED_BY as CHANGED_BY,
    AUDIT_LOG.CHANGED_DATE as CHANGED_DATE,
    CC.ID as IDC,
    CC.REF_AO as REF_AO,
    SP."عدد" as "nn",
    SP.ID as IDS 
 from AUDIT_LOG AUDIT_LOG,
    SP SP,
    CC CC 
 where (CC.ID=RECORD_ID
    or SP.ID =RECORD_ID);

  CREATE OR REPLACE FORCE EDITIONABLE VIEW "MODIF" ("LOG_ID", "TABLE_NAME", "ACTION_TYPE", "RECORD_ID", "OLD_VALUE", "NEW_VALUE", "CHANGED_BY", "CHANGED_DATE", "REF_AO", "ID") AS 
  select AUDIT_LOG.LOG_ID as LOG_ID,
    AUDIT_LOG.TABLE_NAME as TABLE_NAME,
    AUDIT_LOG.ACTION_TYPE as ACTION_TYPE,
    AUDIT_LOG.RECORD_ID as RECORD_ID,
    AUDIT_LOG.OLD_VALUE as OLD_VALUE,
    AUDIT_LOG.NEW_VALUE as NEW_VALUE,
    AUDIT_LOG.CHANGED_BY as CHANGED_BY,
    AUDIT_LOG.CHANGED_DATE as CHANGED_DATE,
    CC.REF_AO as REF_AO,
    CC.ID as ID 
 from AUDIT_LOG AUDIT_LOG,
    CC CC 
 where CC.ID=AUDIT_LOG.RECORD_ID
    and CC.ID =RECORD_ID;

  CREATE OR REPLACE FORCE EDITIONABLE VIEW "MODIFICATION" ("ID_MODIF", "ID_OBJET", "MODIFIER_PAR", "DATE_MODIF", "ID", "REF_AO", "CREER_PAR", "DATE_CRÉATION") AS 
  select SUIVI_MODIF.ID_MODIF as ID_MODIF,
    SUIVI_MODIF.ID_OBJET as ID_OBJET,
    SUIVI_MODIF.MODIFIER_PAR as MODIFIER_PAR,
    SUIVI_MODIF.DATE_MODIF as DATE_MODIF,
    CC.ID as ID,
    CC.REF_AO as REF_AO,
    upper(CC.CREER_PAR) as CREER_PAR,
    CC."DATE_CRÉATION" as "DATE_CRÉATION" 
 from CC CC,
    SUIVI_MODIF SUIVI_MODIF 
 where SUIVI_MODIF.ID_OBJET=CC.ID
    and SUIVI_MODIF.ID_OBJET  =  CC.ID;

  CREATE OR REPLACE FORCE EDITIONABLE VIEW "NOTE_OUVERTUE_PLIS" ("IDC", "REF_AO", "OBJET_CCT", "BUDGET", "DÉTAIL_DE_RÉPONSE", "NATURE_DE_DEPENSE", "DATE_DE_LANC", "DATE_LIMITE_PROPOSÉE", "DATE_OUVERTURE_DES_PLIS", "طريقة_ابرام_الصفقة", "نوعية_الطلب", "اللجنة_المختصة", "التاريخ__للإعلان_عن_المنافسة", "تاريخ__لجنة_الصفقات", "تاريخ_قرار__لجنة_الصفقات") AS 
  select CC.ID,
  CC.REF_AO as REF_AO,
    CC.OBJET_CCT as OBJET_CCT,
    CC.BUDGET as BUDGET,
    CC."DÉTAIL_DE_RÉPONSE" as "DÉTAIL_DE_RÉPONSE",
    CC.NATURE_DE_DEPENSE as NATURE_DE_DEPENSE,
    CC.DATE_DE_LANC as DATE_DE_LANC,
    CC."DATE_LIMITE_PROPOSÉE" as DATE_LIMITE,
    CC.DATE_OUVERTURE_DES_PLIS as DATE_OUVERTURE_DES_PLIS,
    SP."طريقة_ابرام_الصفقة" as "طريقة_ابرام_الصفقة",
    SP."نوعية_الطلب" as "نوعية_الطلب",
    SP."اللجنة_المختصة" as "اللجنة_المختصة",
    SP."التاريخ__للإعلان_عن_المنافسة" as "التاريخ__للإعلان_عن_المنافسة",
    SP."تاريخ__لجنة_الصفقات" as "تاريخ__لجنة_الصفقات",
    SP."تاريخ_قرار__لجنة_الصفقات" as "تاريخ_قرار__لجنة_الصفقات" 
 from SP SP,
    CC CC 
 where CC.ID=SP.ID;

  CREATE OR REPLACE FORCE EDITIONABLE VIEW "NOTIFICATION_OP" ("SPID", "CCID", "REF_DOSSIER", "SUJET", "DATE_OUVERTURE", "JOURS_RESTANTS") AS 
  SELECT 
    SP.ID as SPID,
    CC.ID as CCID, 
    "عدد" as REF_DOSSIER,
    CC.OBJET_CCT as SUJET,
    CC.DATE_OUVERTURE_DES_PLIS as DATE_OUVERTURE,
    TRUNC(DATE_OUVERTURE_DES_PLIS) - TRUNC(SYSDATE) as JOURS_RESTANTS
FROM SP SP,
CC CC
WHERE (SP.ID=CC.ID) AND 
    -- On cherche les dates comprises entre aujourd'hui et dans 3 jours
   (TRUNC(DATE_OUVERTURE_DES_PLIS) BETWEEN TRUNC(SYSDATE) AND TRUNC(SYSDATE) + 7);

  CREATE OR REPLACE FORCE EDITIONABLE VIEW "TABLE_TOTAL" ("ID", "REF_AO", "OBJET_CCT", "BUDGET", "DÉTAIL_DE_RÉPONSE", "NATURE_DE_DEPENSE", "DATE_LIMITE_PROPOSÉE", "DATE_DE_LANC", "PV_CCT", "عدد", "طريقة_ابرام_الصفقة", "نوعية_الطلب", "اللجنة_المختصة", "تاريخ_ورود_CPT_ممضاة", "تاريخ_ارسال_مقترح_تركيبة_لجنة_التقييم", "تاريخ_ورود_تعيين_تركيبة_لجنة_التقييم", "تاريخ_تقديم_كراسات_الشروط_للمصادقة", "تاريخ_مصادقة_اللجنة_على_كراسات_الشروط", "تاريخ_ورود_محضر_مصادقة_اللجنة_على_كراسات_الشروط", "تاريخ_ارجاع_كراسات_الشروط_حسب_المحضر", "تاريخ_ورود_محضر_مصادقة_اللجنة_على_كراسات_الشروط2", "التاريخ__للإعلان_عن_المنافسة", "تاريخ_ارسال_التقرير_للتقييم_الفني", "تاريخ_امضاء_تقرير_تقييم_العروض", "تاريخ_تقديم_الملف_للجنة_الشراءات", "تاريخ__لجنة_الصفقات", "تاريخ_قرار__لجنة_الصفقات", "تاريخ_نشر_نتائج_المنافسة", "تاريخ_تبليغ_الصفقة", "تاريخ_ارجاع_الضمانات_الوقتية", "المكلف_بالملف") AS 
  select CC.ID as ID,
    CC.REF_AO as REF_AO,
    CC.OBJET_CCT as OBJET_CCT,
 
    CC.BUDGET as BUDGET,
    CC."DÉTAIL_DE_RÉPONSE" as "DÉTAIL_DE_RÉPONSE",
    CC.NATURE_DE_DEPENSE as NATURE_DE_DEPENSE,
    CC."DATE_LIMITE_PROPOSÉE" as "DATE_LIMITE_PROPOSÉE",
    CC.DATE_DE_LANC as DATE_DE_LANC,
    CC.PV_CCT as PV_CCT,

    SP."عدد" as "عدد",
    SP."طريقة_ابرام_الصفقة" as "طريقة_ابرام_الصفقة",
    SP."نوعية_الطلب" as "نوعية_الطلب",
    SP."اللجنة_المختصة" as "اللجنة_المختصة",
    SP."تاريخ_ورود_CPT_ممضاة" as "تاريخ_ورود_CPT_ممضاة",
    SP."تاريخ_ارسال_مقترح_تركيبة_لجنة_التقييم" as "تاريخ_ارسال_مقترح_تركيبة_لجنة_التقييم",
    SP."تاريخ_ورود_تعيين_تركيبة_لجنة_التقييم" as "تاريخ_ورود_تعيين_تركيبة_لجنة_التقييم",
    SP."تاريخ_تقديم_كراسات_الشروط_للمصادقة" as "تاريخ_تقديم_كراسات_الشروط_للمصادقة",
    SP."تاريخ_مصادقة_اللجنة_على_كراسات_الشروط" as "تاريخ_مصادقة_اللجنة_على_كراسات_الشروط",
    SP."تاريخ_ورود_محضر_مصادقة_اللجنة_على_كراسات_الشروط" as "تاريخ_ورود_محضر_مصادقة_اللجنة_على_كراسات_الشروط",
    SP."تاريخ_ارجاع_كراسات_الشروط_حسب_المحضر" as "تاريخ_ارجاع_كراسات_الشروط_حسب_المحضر",
    SP."تاريخ_ورود_محضر_مصادقة_اللجنة_على_كراسات_الشروط2" as "تاريخ_ورود_محضر_مصادقة_اللجنة_على_كراسات_الشروط2",
    SP."التاريخ__للإعلان_عن_المنافسة" as "التاريخ__للإعلان_عن_المنافسة",
 
    SP."تاريخ_ارسال_التقرير_للتقييم_الفني" as "تاريخ_ارسال_التقرير_للتقييم_الفني",
    SP."تاريخ_امضاء_تقرير_تقييم_العروض" as "تاريخ_امضاء_تقرير_تقييم_العروض",
    SP."تاريخ_تقديم_الملف_للجنة_الشراءات" as "تاريخ_تقديم_الملف_للجنة_الشراءات",
    SP."تاريخ__لجنة_الصفقات" as "تاريخ__لجنة_الصفقات",
    SP."تاريخ_قرار__لجنة_الصفقات" as "تاريخ_قرار__لجنة_الصفقات",
    SP."تاريخ_نشر_نتائج_المنافسة" as "تاريخ_نشر_نتائج_المنافسة",
    SP."تاريخ_تبليغ_الصفقة" as "تاريخ_تبليغ_الصفقة",
    SP."تاريخ_ارجاع_الضمانات_الوقتية" as "تاريخ_ارجاع_الضمانات_الوقتية",
    SP."المكلف_بالملف" as "المكلف_بالملف" 
 from SP SP,
    CC CC 
 where SP.ID=CC.ID;

  CREATE OR REPLACE FORCE EDITIONABLE VIEW "V_FACTURES" ("ID", "ID_CONTRAT", "N_CONTRAT_BC", "TITULAIRE_DU_MARCHÉ", "OBJET_CONTRAT", "MONTANT_CONTRAT", "ETAT_CONTRAT", "RESPONSABLE", "N_FACTURE", "DATE_FACTURE", "DATE_RECEPTION", "MONTANT_HT", "MONTANT_TVA", "MONTANT_TTC", "DEVISE", "DATE_VALIDATION", "VALIDEE_PAR", "DATE_PAIEMENT", "REF_VIREMENT", "BANQUE", "STATUT", "MOTIF_REJET", "OBSERVATION", "JOURS_DEPUIS_VALIDATION", "INDICATEUR_RETARD", "STATUT_CSS_CLASS", "DATE_CREATION", "CREE_PAR", "DATE_MAJ", "MAJ_PAR") AS 
  SELECT 
    f.ID, 
    f.ID_CONTRAT, 
    c.N_CONTRAT_BC, 
    c.TITULAIRE_DU_MARCHÉ, 
    c.OBJET                                     AS OBJET_CONTRAT, 
    c.MONTANT                                   AS MONTANT_CONTRAT, 
    c.ETAT                                      AS ETAT_CONTRAT, 
    c.RESPONSABLE, 
 
    -- Identification facture 
    f.N_FACTURE, 
    f.DATE_FACTURE, 
    f.DATE_RECEPTION, 
 
    -- Montants 
    f.MONTANT_HT, 
    f.MONTANT_TVA, 
    f.MONTANT_TTC, 
    f.DEVISE, 
 
    -- Validation 
    f.DATE_VALIDATION, 
    f.VALIDEE_PAR, 
 
    -- Paiement 
    f.DATE_PAIEMENT, 
    f.REF_VIREMENT, 
    f.BANQUE, 
 
    -- Statut 
    f.STATUT, 
    f.MOTIF_REJET, 
    f.OBSERVATION, 
 
    -- Calcul retard : nb jours depuis validation sans paiement 
    CASE 
        WHEN f.STATUT IN ('Validée', 'En attente validation') 
             AND f.DATE_VALIDATION IS NOT NULL 
             AND f.DATE_PAIEMENT   IS NULL 
        THEN TRUNC(SYSDATE - f.DATE_VALIDATION) 
        ELSE NULL 
    END                                         AS JOURS_DEPUIS_VALIDATION, 
 
    -- Indicateur retard pour mise en forme conditionnelle APEX 
    CASE 
        WHEN f.STATUT IN ('Validée', 'En attente validation') 
             AND f.DATE_VALIDATION IS NOT NULL 
             AND f.DATE_PAIEMENT   IS NULL 
             AND TRUNC(SYSDATE - f.DATE_VALIDATION) > 30 
        THEN 'RETARD' 
        WHEN f.STATUT IN ('Validée', 'En attente validation') 
             AND f.DATE_VALIDATION IS NOT NULL 
             AND f.DATE_PAIEMENT   IS NULL 
             AND TRUNC(SYSDATE - f.DATE_VALIDATION) BETWEEN 15 AND 30 
        THEN 'ATTENTION' 
        ELSE 'OK' 
    END                                         AS INDICATEUR_RETARD, 
 
    -- Classe CSS pour badge statut (utilisable directement dans APEX HTML Expr.) 
    CASE f.STATUT 
        WHEN 'Payée'                  THEN 'u-color-15' 
        WHEN 'Validée'                THEN 'u-color-1' 
        WHEN 'En attente validation'  THEN 'u-color-8' 
        WHEN 'Rejetée'                THEN 'u-color-9' 
        ELSE                               'u-color-45' 
    END                                         AS STATUT_CSS_CLASS, 
 
    f.DATE_CREATION, 
    f.CREE_PAR, 
    f.DATE_MAJ, 
    f.MAJ_PAR 
 
FROM FACTURES f 
JOIN CONTRATS c ON c.ID = f.ID_CONTRAT;

  CREATE OR REPLACE FORCE EDITIONABLE VIEW "V_SUIVI_CONTRATS" ("ID_CONTRAT", "NUMERO_CONTRAT", "LIBELLE", "DATE_LIVRAISON_JURIDIQUE", "DATE_AVIS_JURIDIQUE", "DELAI_JURIDIQUE_HEURES", "DATE_ENVOI_CLIENT_SIGNATURE", "DATE_RETOUR_CLIENT_SIGNE", "DATE_ENVOI_ADMIN_SIGNATURE", "DATE_RETOUR_ADMIN_SIGNE", "DATE_ENVOI_CLIENT_ENREGISTREMENT", "DATE_RETOUR_ENREGISTRE", "DATE_GARANTIE_FINALE", "RESPONSABLE_MO", "STATUT") AS 
  SELECT  
    ID_CONTRAT, 
    NUMERO_CONTRAT, 
    LIBELLE, 
    DATE_LIVRAISON_JURIDIQUE, 
    DATE_AVIS_JURIDIQUE, 
    -- Calcul du délai juridique 
    ROUND((DATE_AVIS_JURIDIQUE - DATE_LIVRAISON_JURIDIQUE)*24,1) AS DELAI_JURIDIQUE_HEURES, 
    DATE_ENVOI_CLIENT_SIGNATURE, 
    DATE_RETOUR_CLIENT_SIGNE, 
    DATE_ENVOI_ADMIN_SIGNATURE, 
    DATE_RETOUR_ADMIN_SIGNE, 
    DATE_ENVOI_CLIENT_ENREGISTREMENT, 
    DATE_RETOUR_ENREGISTRE, 
    DATE_GARANTIE_FINALE, 
    RESPONSABLE_MO, 
    -- Statut calculé 
    CASE  
        WHEN DATE_GARANTIE_FINALE IS NOT NULL THEN 'TERMINÉ' 
        WHEN DATE_RETOUR_ENREGISTRE IS NOT NULL THEN 'EN ATTENTE GARANTIE' 
        WHEN DATE_RETOUR_ADMIN_SIGNE IS NOT NULL THEN 'EN COURS ENREGISTREMENT' 
        ELSE 'EN COURS' 
    END AS STATUT 
FROM SUIVI_CONTRATS; 