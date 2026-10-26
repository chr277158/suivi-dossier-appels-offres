import { useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, ChevronDown, CircleAlert, FileCheck2, Search } from 'lucide-react';
import type { Language } from './i18n';
import './purchasing-guide.css';

type Copy = {
  title: string; subtitle: string; search: string; introTitle: string; intro: string;
  contents: string; lifecycleTitle: string; stages: { title: string; text: string; checks: string[] }[];
  proceduresTitle: string; procedures: { title: string; when: string; summary: string; tag: string }[];
  actorsTitle: string; actors: { title: string; text: string }[];
  practicalTitle: string; practical: string[]; updateTitle: string; update: string;
  sourcesTitle: string; sources: string[]; baseline: string; pvTag: string; empty: string;
};

const copy: Record<Language, Copy> = {
  fr: {
    title: 'Guide des procédures d’achats hors matières premières',
    subtitle: 'Un repère pratique pour préparer, suivre et documenter un achat, de l’expression du besoin à sa clôture.',
    search: 'Rechercher une procédure ou une étape…', introTitle: 'Comment utiliser ce guide',
    intro: 'Commencez par le parcours général, puis ouvrez la famille de procédure correspondant au dossier. Les conditions précises, seuils, délais et modèles applicables restent ceux du manuel officiel et des annexes en vigueur. Ce guide aide à s’orienter; il ne remplace ni les pièces du dossier ni les validations requises.',
    contents: 'Dans ce guide', lifecycleTitle: 'Parcours commun d’un achat',
    stages: [
      { title: '1. Définir le besoin', text: 'La structure demandeuse décrit précisément la nature, l’étendue et l’objet du besoin, sans le fractionner pour échapper à la procédure applicable.', checks: ['Vérifier que le besoin est prévu au budget et que les crédits sont suffisants.', 'Examiner le plan prévisionnel, les possibilités de regroupement et l’existence d’un contrat-cadre valide.'] },
      { title: '2. Préparer les spécifications et l’estimation', text: 'La structure demandeuse prépare les spécifications techniques, les critères et la méthodologie d’évaluation ainsi que les éléments financiers adaptés au type de prix.', checks: ['Rédiger des exigences précises, accessibles et liées à l’objet de l’achat.', 'Éviter les références discriminatoires à une marque, une origine ou un procédé, sauf règle officielle applicable.', 'Documenter l’estimation et vérifier sa cohérence avec le budget.'] },
      { title: '3. Constituer et faire approuver la demande', text: 'Assembler la demande d’achat et ses annexes, obtenir les signatures prévues, puis transmettre le dossier à la structure d’achat compétente.', checks: ['Joindre la demande, le dossier technique, les critères d’évaluation et le modèle financier.', 'Ajouter, selon le cas, l’autorisation d’engagement, la note d’opportunité ou la justification de négociation directe.', 'Vérifier les approbateurs applicables selon les seuils et annexes en vigueur.'] },
      { title: '4. Choisir et préparer la procédure', text: 'La structure d’achat vérifie la complétude, examine le regroupement et détermine la procédure selon la nature et le montant estimatif du besoin.', checks: ['Utiliser la version applicable des seuils et délégations; ne pas déduire un seuil de ce guide.', 'Préparer le cahier des charges et les conditions de participation, d’évaluation et d’attribution.', 'Faire approuver le cahier des charges par les instances prévues avant lancement.'] },
      { title: '5. Publier ou consulter', text: 'Lancer la consultation selon la procédure retenue, par les canaux et dans les délais prescrits par les documents applicables.', checks: ['Conserver l’avis ou les invitations, le dossier publié et les preuves de publication/envoi.', 'Tracer les clarifications et communiquer les réponses aux concurrents concernés selon les règles.', 'Respecter les règles de réception et de conservation des offres.'] },
      { title: '6. Ouvrir et évaluer les offres', text: 'Les commissions compétentes ouvrent les offres et évaluent les dossiers conformément aux critères annoncés dans le cahier des charges.', checks: ['Vérifier les pièces et la conformité selon les exigences annoncées.', 'Appliquer la méthode et les critères sans les modifier après réception des offres.', 'Consigner les opérations, motifs et résultats dans les procès-verbaux et rapports requis.'] },
      { title: '7. Approuver et attribuer', text: 'Soumettre les résultats aux contrôles et approbations requis, notifier le résultat puis préparer le contrat ou la commande.', checks: ['Vérifier les avis et autorisations préalables à l’attribution.', 'Archiver la décision, les notifications et les éventuelles garanties.', 'Mettre à jour le dossier et les échéances de suivi dans l’application.'] },
      { title: '8. Suivre l’exécution et clôturer', text: 'Suivre les livrables, délais, réceptions, paiements, garanties et obligations contractuelles jusqu’au règlement définitif et à la clôture.', checks: ['Désigner et tracer le responsable du suivi et les événements importants.', 'Documenter les réceptions, réserves, pénalités et modifications éventuelles.', 'Constituer le dossier de règlement définitif et appliquer les délais du manuel.'] },
    ],
    proceduresTitle: 'Choisir la famille de procédure',
    procedures: [
      { title: 'Achats hors marchés', when: 'Besoin relevant d’une procédure d’achat hors marché, selon les seuils et compétences applicables.', summary: 'Le manuel décrit notamment la régie (demande directe d’achat), la demande de cotations et la consultation à compétition restreinte. La structure d’achat confirme la voie autorisée et les pièces à produire au regard du montant estimatif.', tag: 'À vérifier selon seuil' },
      { title: 'Consultation ouverte et appel d’offres', when: 'Mise en concurrence ouverte ou procédure de marché déterminée par le montant et la nature du besoin.', summary: 'Préparer et approuver le dossier de consultation/appel d’offres, publier l’avis, recevoir les offres, puis appliquer l’ouverture, l’évaluation et l’attribution prévues. Le manuel prévoit plusieurs formes d’appel d’offres selon le besoin.', tag: 'Mise en concurrence' },
      { title: 'Négociation directe', when: 'Uniquement lorsqu’un cas autorisé par le manuel est établi et justifié.', summary: 'La justification du recours est documentée et signée par l’autorité compétente. Le dossier suit les contrôles et approbations requis. Le PV 2026 mentionne une évolution envisagée de cette justification; voir l’encadré de mise à jour avant toute application.', tag: 'Justification requise' },
      { title: 'Prestations intellectuelles', when: 'Mission de conseil, étude, formation ou autre prestation intellectuelle.', summary: 'Le manuel décrit plusieurs méthodes de sélection (qualité et coût, qualité, moindre coût, budget déterminé, qualifications de consultants individuels et entente directe). La méthode doit correspondre à la mission et être définie dans le dossier avant consultation.', tag: 'Méthode à définir en amont' },
      { title: 'Contrats-cadres et achats récurrents', when: 'Besoin récurrent ou commandes pouvant être planifiées sur une période.', summary: 'Évaluer le regroupement et l’usage d’un contrat-cadre. À chaque commande, vérifier le contrat applicable, sa validité, les quantités restantes et les conditions de commande.', tag: 'Vérifier validité et reliquat' },
      { title: 'Biens d’occasion usagés', when: 'Équipement ou pièce d’occasion répondant aux cas particuliers prévus par le manuel.', summary: 'Le dossier précise les exigences minimales, l’âge, l’état et les garanties attendues. Le manuel demande une note explicative validée et signée par la Direction générale; les modes de passation suivent la valeur et les règles applicables.', tag: 'Règles particulières' },
    ],
    actorsTitle: 'Qui intervient ?', actors: [
      { title: 'Structure demandeuse', text: 'Exprime et justifie le besoin, prépare les spécifications, les critères et l’estimation, puis suit l’exécution selon les responsabilités attribuées.' },
      { title: 'Structure d’achat / DCAHMP', text: 'Vérifie le dossier, étudie le regroupement, détermine et met en œuvre la procédure, prépare les pièces de consultation et assure la traçabilité de l’achat.' },
      { title: 'Commissions et organes de contrôle', text: 'Interviennent selon la procédure, les seuils et les compétences définis par le manuel et ses annexes : approbation des cahiers des charges, ouverture, évaluation et contrôle.' },
      { title: 'Autorités habilitées', text: 'Signent ou approuvent les demandes, notes et résultats selon les délégations et seuils en vigueur. Vérifier les tableaux officiels avant chaque validation.' },
    ],
    practicalTitle: 'Avant de faire avancer un dossier', practical: [
      'Le besoin, son estimation et le financement sont clairement documentés.',
      'La procédure et la commission compétente sont justifiées par les règles officielles à jour.',
      'Les critères, la méthode d’évaluation et les conditions d’attribution sont annoncés avant la réception des offres.',
      'Chaque approbation, publication, ouverture, évaluation, décision et notification laisse une trace datée au dossier.',
      'Les dates de suivi et les documents utiles sont saisis dans l’application dès qu’ils sont connus.',
    ],
    updateTitle: 'Évolutions évoquées au PV du 29 avril 2026',
    update: 'Le procès-verbal consigne des orientations pour la révision du manuel : méthode d’attribution par lot puis, à défaut, par article; clarification des commissions et méthodes d’évaluation; suppression des offres « substantiellement conformes »; urgence justifiée pour la régie; consultation élargie via TUNEPS en parallèle dans certains cas; règles sur les achats régularisés; évolution de la justification de négociation directe; et adaptations des spécifications/commissions. Ces points sont séparés du référentiel 2022 : leur rédaction finale, les listes concernées et leur date d’entrée en vigueur doivent être confirmées dans le manuel révisé ou une instruction officielle avant application.',
    sourcesTitle: 'Références documentaires', sources: ['Manuel Achats GCT du 29 décembre 2022 — chapitre 2 : Procédures des achats hors matières premières.', 'Procès-verbal de réunion du 29 avril 2026 — orientations de mise à jour du manuel.'],
    baseline: 'Référentiel principal : Manuel Achats GCT, version du 29/12/2022. Vérifier les annexes, notes et mises à jour officielles applicables au dossier.', pvTag: 'PV 2026 · mise en œuvre à confirmer', empty: 'Aucune rubrique ne correspond à cette recherche.',
  },
  ar: {
    title: 'دليل إجراءات شراء المواد غير الأولية',
    subtitle: 'مرجع عملي لإعداد عملية الشراء ومتابعتها وتوثيقها من تحديد الحاجة إلى إقفال الملف.',
    search: 'ابحث عن إجراء أو مرحلة…', introTitle: 'كيفية استخدام هذا الدليل',
    intro: 'ابدأ بالمسار العام، ثم اختر فئة الإجراء المناسبة للملف. تبقى الشروط والعتبات والآجال والنماذج المعمول بها هي المحددة في الدليل الرسمي وملاحقه السارية. يساعد هذا الدليل على التوجيه ولا يعوض وثائق الملف أو المصادقات المطلوبة.',
    contents: 'محتويات الدليل', lifecycleTitle: 'المسار العام للشراء',
    stages: [
      { title: '١. تحديد الحاجة', text: 'تصف الجهة الطالبة طبيعة الحاجة ونطاقها وموضوعها بدقة، دون تجزئتها للتحايل على الإجراء الواجب التطبيق.', checks: ['التحقق من إدراج الحاجة في الميزانية وتوفر الاعتمادات الكافية.', 'مراجعة الخطة التقديرية وإمكانية التجميع ووجود عقد إطاري ساري.'] },
      { title: '٢. إعداد المواصفات والتقدير', text: 'تعد الجهة الطالبة المواصفات الفنية ومعايير ومنهجية التقييم والعناصر المالية المناسبة لنوع السعر.', checks: ['صياغة متطلبات دقيقة وميسرة ومرتبطة بموضوع الشراء.', 'تجنب الإشارات التمييزية إلى علامة أو منشأ أو طريقة تصنيع إلا وفق قاعدة رسمية واجبة التطبيق.', 'توثيق التقدير والتحقق من توافقه مع الميزانية.'] },
      { title: '٣. تكوين طلب الشراء والمصادقة عليه', text: 'جمع طلب الشراء وملاحقه، واستكمال التوقيعات المطلوبة، ثم إحالة الملف إلى هيكل الشراء المختص.', checks: ['إرفاق الطلب والملف الفني ومعايير التقييم والنموذج المالي.', 'إضافة ترخيص الالتزام بالنفقات أو مذكرة الفرصة أو تبرير التفاوض المباشر عند الاقتضاء.', 'التحقق من أصحاب صلاحية المصادقة حسب العتبات والملاحق السارية.'] },
      { title: '٤. اختيار الإجراء وإعداده', text: 'يتحقق هيكل الشراء من اكتمال الملف وإمكانية التجميع ويحدد الإجراء حسب طبيعة الحاجة ومبلغها التقديري.', checks: ['استخدام العتبات والتفويضات السارية وعدم استنتاج عتبة من هذا الدليل.', 'إعداد كراس الشروط وشروط المشاركة والتقييم والإسناد.', 'الحصول على مصادقة الجهات المختصة على كراس الشروط قبل إطلاق الإجراء.'] },
      { title: '٥. الإعلان أو الاستشارة', text: 'إطلاق الاستشارة وفق الإجراء المختار والقنوات والآجال المحددة في الوثائق المعمول بها.', checks: ['حفظ الإعلان أو الدعوات والملف المنشور وأدلة النشر أو الإرسال.', 'توثيق الاستفسارات وإبلاغ الإجابات للمتنافسين المعنيين وفق القواعد.', 'احترام قواعد تسلم العروض وحفظها.'] },
      { title: '٦. فتح العروض وتقييمها', text: 'تتولى اللجان المختصة فتح العروض وتقييم الملفات وفق المعايير المعلنة في كراس الشروط.', checks: ['التحقق من الوثائق والمطابقة حسب المتطلبات المعلنة.', 'تطبيق الطريقة والمعايير دون تغييرها بعد تسلم العروض.', 'تسجيل الإجراءات والأسباب والنتائج في المحاضر والتقارير المطلوبة.'] },
      { title: '٧. المصادقة والإسناد', text: 'إحالة النتائج على جهات الرقابة والمصادقة المطلوبة، ثم إعلام النتيجة وإعداد العقد أو الطلبية.', checks: ['التحقق من الآراء والتراخيص السابقة للإسناد.', 'أرشفة القرار والإشعارات والضمانات عند الاقتضاء.', 'تحيين الملف وآجال المتابعة في التطبيق.'] },
      { title: '٨. متابعة التنفيذ والإقفال', text: 'متابعة المخرجات والآجال والاستلام والدفع والضمانات والالتزامات حتى التسوية النهائية وإقفال الملف.', checks: ['تحديد مسؤول المتابعة وتوثيق الأحداث المهمة.', 'توثيق الاستلام والتحفظات والخطايا والتعديلات إن وجدت.', 'إعداد ملف التسوية النهائية واحترام آجال الدليل.'] },
    ],
    proceduresTitle: 'اختيار فئة الإجراء', procedures: [
      { title: 'المشتريات خارج الصفقات', when: 'حاجة تخضع لإجراء شراء خارج الصفقة وفق العتبات والصلاحيات المعمول بها.', summary: 'يذكر الدليل خاصة الشراء المباشر (الرّيجِي) وطلب الأسعار والاستشارة ذات المنافسة المحدودة. يؤكد هيكل الشراء الإجراء المسموح والوثائق المطلوبة بالنظر إلى المبلغ التقديري.', tag: 'التحقق حسب العتبة' },
      { title: 'الاستشارة المفتوحة وطلب العروض', when: 'منافسة مفتوحة أو إجراء صفقة يحدده مبلغ الحاجة وطبيعتها.', summary: 'إعداد والمصادقة على ملف الاستشارة أو طلب العروض، ونشر الإعلان، وتسلم العروض، ثم تطبيق قواعد الفتح والتقييم والإسناد. ينص الدليل على صيغ متعددة لطلب العروض بحسب الحاجة.', tag: 'منافسة' },
      { title: 'التفاوض المباشر', when: 'فقط عند ثبوت حالة يسمح بها الدليل وتبريرها.', summary: 'يوثق تبرير اللجوء إلى التفاوض ويوقعه صاحب الصلاحية. يخضع الملف للرقابة والمصادقات المطلوبة. يشير محضر 2026 إلى تطور مقترح لهذا التبرير؛ راجع تنبيه التحيين قبل التطبيق.', tag: 'يتطلب التبرير' },
      { title: 'الخدمات الفكرية', when: 'مهمة استشارة أو دراسة أو تكوين أو خدمة فكرية أخرى.', summary: 'يعرض الدليل طرق اختيار متعددة، منها الجودة والكلفة والجودة وحدها وأقل كلفة والميزانية المحددة ومؤهلات المستشار الفردي والتعاقد المباشر. يجب أن تلائم الطريقة المهمة وأن تحدد بالملف قبل الاستشارة.', tag: 'تحديد الطريقة مسبقاً' },
      { title: 'العقود الإطارية والمشتريات المتكررة', when: 'حاجة متكررة أو طلبيات يمكن برمجتها على فترة.', summary: 'دراسة التجميع وإمكانية استعمال عقد إطاري. عند كل طلبية، يجب التحقق من العقد المعني وصلاحيته والكميات المتبقية وشروط الطلب.', tag: 'التحقق من الصلاحية والرصيد' },
      { title: 'المعدات المستعملة', when: 'معدات أو قطع مستعملة ينطبق عليها ما يحدده الدليل من حالات خاصة.', summary: 'يحدد الملف المتطلبات الدنيا والعمر والحالة والضمانات المطلوبة. يطلب الدليل مذكرة تفسيرية مصادقاً عليها وممضاة من الإدارة العامة؛ وتتبع طرق الشراء قيمة الحاجة والقواعد المعمول بها.', tag: 'أحكام خاصة' },
    ],
    actorsTitle: 'الأطراف المتدخلة', actors: [
      { title: 'الجهة الطالبة', text: 'تحدد الحاجة وتبررها، وتعد المواصفات والمعايير والتقدير، ثم تتابع التنفيذ حسب المسؤوليات المسندة.' },
      { title: 'هيكل الشراء / الإدارة المركزية', text: 'يتحقق من الملف ويدرس التجميع ويحدد الإجراء وينفذه ويعد وثائق الاستشارة ويضمن توثيق عملية الشراء.' },
      { title: 'اللجان وهيئات الرقابة', text: 'تتدخل بحسب الإجراء والعتبات والصلاحيات المحددة في الدليل وملاحقه: المصادقة على كراسات الشروط وفتح العروض وتقييمها والرقابة.' },
      { title: 'أصحاب الصلاحية', text: 'يمضون أو يصادقون على الطلبات والمذكرات والنتائج وفق التفويضات والعتبات السارية. يجب مراجعة الجداول الرسمية قبل كل مصادقة.' },
    ],
    practicalTitle: 'قبل تحريك الملف إلى المرحلة التالية', practical: [
      'الحاجة وتقديرها وتمويلها موثقة بوضوح.', 'الإجراء واللجنة المختصة معللان وفق القواعد الرسمية المحينة.', 'معايير التقييم وطريقته وشروط الإسناد معلنة قبل تسلم العروض.', 'كل مصادقة أو إعلان أو فتح أو تقييم أو قرار أو إعلام موثق بتاريخ في الملف.', 'تسجيل تواريخ المتابعة والوثائق المهمة في التطبيق فور توفرها.'
    ],
    updateTitle: 'توجهات محضر 29 أفريل 2026',
    update: 'يتضمن محضر الاجتماع توجهات لمراجعة الدليل: الإسناد لكامل الحصة ثم، عند التعذر، حسب البنود؛ توضيح اللجان وطرق التقييم؛ عدم قبول العروض «المطابقة جوهرياً»؛ تبرير الاستعجال في الشراء المباشر؛ توسيع الاستشارة عبر TUNEPS بالتوازي في بعض الحالات؛ تنظيم المشتريات المسواة؛ تطوير تبرير التفاوض المباشر؛ وتعديلات تخص المواصفات واللجان. تعرض هذه النقاط منفصلة عن مرجع 2022. يجب تأكيد الصياغة النهائية والقوائم المعنية وتاريخ بدء النفاذ في الدليل المحين أو بتعليمة رسمية قبل تطبيقها.',
    sourcesTitle: 'المراجع', sources: ['دليل مشتريات GCT المؤرخ 29 ديسمبر 2022 — الفصل الثاني: إجراءات شراء المواد غير الأولية.', 'محضر اجتماع 29 أفريل 2026 — توجهات تحيين دليل المشتريات.'],
    baseline: 'المرجع الأساسي: دليل مشتريات GCT بتاريخ 29/12/2022. يجب التحقق من الملاحق والمذكرات والتحيينات الرسمية المنطبقة على الملف.', pvTag: 'محضر 2026 · التطبيق يحتاج إلى تأكيد', empty: 'لا توجد نتائج مطابقة لهذا البحث.',
  },
};

export function PurchasingGuidePage({ language }: { language: Language }) {
  const [query, setQuery] = useState('');
  const [openStage, setOpenStage] = useState<number | null>(0);
  const c = copy[language];
  const rtl = language === 'ar';
  const normalized = query.trim().toLocaleLowerCase(language);
  const procedures = useMemo(() => c.procedures.filter((item) => !normalized || `${item.title} ${item.when} ${item.summary} ${item.tag}`.toLocaleLowerCase(language).includes(normalized)), [c, language, normalized]);
  return <main className="pguide" lang={language} dir={rtl ? 'rtl' : 'ltr'}>
    <header className="pguide-hero"><div className="pguide-hero-icon"><BookOpen size={24} /></div><div><span className="pguide-kicker">GCT · {rtl ? 'دليل المستخدم' : 'RÉFÉRENCE UTILISATEUR'}</span><h1>{c.title}</h1><p>{c.subtitle}</p></div></header>
    <div className="pguide-baseline"><FileCheck2 size={18} /><span>{c.baseline}</span></div>
    <section className="pguide-intro"><h2>{c.introTitle}</h2><p>{c.intro}</p></section>
    <div className="pguide-layout">
      <aside className="pguide-index"><h2>{c.contents}</h2><a href="#pguide-process">{c.lifecycleTitle}</a><a href="#pguide-procedures">{c.proceduresTitle}</a><a href="#pguide-actors">{c.actorsTitle}</a><a href="#pguide-checklist">{c.practicalTitle}</a><a href="#pguide-update">{c.updateTitle}</a><a href="#pguide-sources">{c.sourcesTitle}</a></aside>
      <div className="pguide-main">
        <section id="pguide-process" className="pguide-section"><div className="pguide-section-heading"><span>01</span><h2>{c.lifecycleTitle}</h2></div><div className="pguide-stages">{c.stages.map((stage, index) => <article className={`pguide-stage ${openStage === index ? 'is-open' : ''}`} key={stage.title}><button className="pguide-stage-toggle" onClick={() => setOpenStage(openStage === index ? null : index)} aria-expanded={openStage === index}><span className="pguide-stage-number">{String(index + 1).padStart(2, '0')}</span><span className="pguide-stage-title">{stage.title}</span><ChevronDown size={18} /></button>{openStage === index && <div className="pguide-stage-body"><p>{stage.text}</p><ul>{stage.checks.map((check) => <li key={check}><CheckCircle2 size={16} />{check}</li>)}</ul></div>}</article>)}</div></section>
        <section id="pguide-procedures" className="pguide-section"><div className="pguide-section-heading"><span>02</span><h2>{c.proceduresTitle}</h2></div><label className="pguide-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={c.search} /><span>{procedures.length}</span></label>{procedures.length ? <div className="pguide-procedure-grid">{procedures.map((procedure) => <article className="pguide-procedure" key={procedure.title}><span className="pguide-tag">{procedure.tag}</span><h3>{procedure.title}</h3><b>{procedure.when}</b><p>{procedure.summary}</p></article>)}</div> : <p className="pguide-empty">{c.empty}</p>}</section>
        <section id="pguide-actors" className="pguide-section"><div className="pguide-section-heading"><span>03</span><h2>{c.actorsTitle}</h2></div><div className="pguide-actors">{c.actors.map((actor) => <article key={actor.title}><h3>{actor.title}</h3><p>{actor.text}</p></article>)}</div></section>
        <section id="pguide-checklist" className="pguide-section"><div className="pguide-section-heading"><span>04</span><h2>{c.practicalTitle}</h2></div><ul className="pguide-checklist">{c.practical.map((item) => <li key={item}><CheckCircle2 size={17} />{item}</li>)}</ul></section>
        <section id="pguide-update" className="pguide-update"><span className="pguide-tag"><CircleAlert size={14} />{c.pvTag}</span><h2>{c.updateTitle}</h2><p>{c.update}</p></section>
        <section id="pguide-sources" className="pguide-sources"><h2>{c.sourcesTitle}</h2><ul>{c.sources.map((source) => <li key={source}>{source}</li>)}</ul></section>
      </div>
    </div>
  </main>;
}
