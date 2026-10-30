import { ArrowDownToLine, ArrowLeft, BookOpen } from 'lucide-react';
import type { Language } from './i18n';
import './purchasing-manual.css';

export function PurchasingManualPage({ language, onBack }: { language: Language; onBack: () => void }) {
  const rtl = language === 'ar';
  return <main className="pmanual" lang={language} dir={rtl ? 'rtl' : 'ltr'}>
    <header className="pmanual-header">
      <button type="button" className="pmanual-back" onClick={onBack}><ArrowLeft size={18} />{rtl ? 'العودة إلى دليل الإجراءات' : 'Retour au guide pratique'}</button>
      <div className="pmanual-title"><BookOpen size={23} /><div><h1>{rtl ? 'الدليل الكامل للمشتريات خارج المواد الأولية' : 'Guide complet des achats hors matières premières'}</h1><p>{rtl ? 'دليل مشتريات GCT — 29 ديسمبر 2022' : 'Manuel Achats GCT — 29 décembre 2022'}</p></div></div>
      <a className="pmanual-download" href={rtl ? "/Manuel-Achats-GCT-29-12-2022-ar.docx" : "/Manuel-Achats-GCT-29-12-2022.docx"} download><ArrowDownToLine size={17} />{rtl ? '\u062a\u062d\u0645\u064a\u0644\u0020\u0627\u0644\u0646\u0633\u062e\u0629\u0020\u0627\u0644\u0639\u0631\u0628\u064a\u0629' : 'Télécharger le manuel original'}</a>
    </header>
    <p className="pmanual-help">{rtl ? '\u0627\u0628\u062d\u062b\u0020\u0641\u064a\u0020\u0627\u0644\u0646\u0633\u062e\u0629\u0020\u0627\u0644\u0639\u0631\u0628\u064a\u0629\u0020\u0627\u0644\u0645\u062a\u0631\u062c\u0645\u0629\u0020\u0622\u0644\u064a\u0627\u064b\u002e\u0020\u0639\u0646\u062f\u0020\u062a\u0641\u0633\u064a\u0631\u0020\u0627\u0644\u0623\u062d\u0643\u0627\u0645\u060c\u0020\u064a\u064f\u0631\u062c\u0649\u0020\u0627\u0639\u062a\u0645\u0627\u062f\u0020\u0627\u0644\u0646\u0633\u062e\u0629\u0020\u0627\u0644\u0641\u0631\u0646\u0633\u064a\u0629\u0020\u0627\u0644\u0623\u0635\u0644\u064a\u0629\u002e' : 'Recherchez dans le texte complet du manuel. Utilisez les boutons « Précédent » et « Suivant » pour parcourir les résultats.'}</p>
    <iframe className="pmanual-frame" title={rtl ? '\u0627\u0644\u062f\u0644\u064a\u0644\u0020\u0627\u0644\u0643\u0627\u0645\u0644\u0020\u0644\u0644\u0645\u0634\u062a\u0631\u064a\u0627\u062a' : 'Manuel Achats GCT complet'} src={rtl ? '/manuel-achats-complet-ar.html' : '/manuel-achats-complet.html'} />
  </main>;
}
