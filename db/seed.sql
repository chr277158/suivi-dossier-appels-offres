-- Development/demo fixtures only. The supplied test credential is public by design.
-- Never run this seed against production; use a unique administrator password there.
INSERT INTO app_users (email, full_name, password_hash, role)
VALUES ('admin@gct.tn', 'Administrateur de démonstration', crypt('Admin123!', gen_salt('bf')), 'admin')
ON CONFLICT (email) DO NOTHING;

INSERT INTO dossiers (reference, subject, estimated_cost, expense_nature, procedure_type, committee, owner_name, status,
  announcement_date, submission_deadline, bid_opening_date, committee_decision_date, specification_approval_date,
  evaluation_report_date, contract_notification_date, results_publication_date)
VALUES
  ('AO-2026-014', 'Maintenance des équipements de laboratoire', 185.500, 'Services', 'Appel d''offres', 'Commission régionale', 'N. Ben Salem', 'published', '2026-09-15', '2026-10-20', '2026-10-21', NULL, '2026-08-27', NULL, NULL, NULL),
  ('AO-2026-011', 'Fourniture de pièces industrielles', 92.000, 'Fournitures', 'Consultation', 'Commission interne', 'S. Trabelsi', 'evaluation', '2026-07-01', '2026-08-15', '2026-08-18', NULL, '2026-06-12', NULL, NULL, NULL),
  ('AO-2026-008', 'Travaux de rénovation du bâtiment administratif', 640.000, 'Travaux', 'Appel d''offres', 'Commission régionale', 'A. Gharbi', 'awarded', '2026-04-02', '2026-05-10', '2026-05-12', '2026-06-01', '2026-03-20', '2026-05-27', '2026-06-15', '2026-06-17'),
  ('AO-2026-004', 'Acquisition de mobilier de bureau', 48.000, 'Fournitures', 'Consultation', 'Commission interne', 'M. Khelifi', 'unsuccessful', '2026-02-10', '2026-03-02', '2026-03-04', '2026-03-21', '2026-01-26', NULL, NULL, '2026-03-25')
ON CONFLICT (reference) DO NOTHING;

INSERT INTO contracts (dossier_id, contract_number, subject, holder, amount, currency, state,
  date_first_legal_document, date_send_admin_signature, date_admin_signed_return, date_send_client_signature,
  date_client_signed_return, date_send_registration, date_registered_return, date_effective, date_archived)
SELECT d.id, 'BC-2026-008', d.subject, 'Techno Services Tunis', 638.250, 'TND', 'active',
  '2026-06-03', '2026-06-05', '2026-06-10', '2026-06-11', '2026-06-14', '2026-06-16', '2026-06-18', '2026-06-20', NULL
FROM dossiers d WHERE d.reference = 'AO-2026-008'
ON CONFLICT (contract_number) DO NOTHING;

INSERT INTO contracts (contract_number, subject, holder, amount, currency, state, date_first_legal_document)
VALUES ('BC-2026-002', 'Réparation du réseau électrique', 'Énergie & Réseaux', 78.900, 'TND', 'pending', '2026-09-25')
ON CONFLICT (contract_number) DO NOTHING;

INSERT INTO annual_programs (fiscal_year, reference, subject, request_type, committee, procedure_type, estimated_cost, funding_source, estimated_duration_days, estimated_start_date, estimated_announcement_date, estimated_opening_date)
VALUES
  (2026, 'PA-2026-001', 'Renouvellement des équipements informatiques', 'Fournitures', 'Commission régionale', 'Appel d''offres', 120.000, 'Budget investissement', 90, '2026-11-01', '2026-11-10', '2026-12-15'),
  (2026, 'PA-2026-002', 'Maintenance des installations techniques', 'Services', 'Commission interne', 'Consultation', 45.000, 'Budget fonctionnement', 45, '2026-09-01', '2026-09-10', '2026-10-05')
ON CONFLICT (fiscal_year, reference) DO NOTHING;

INSERT INTO work_schedule (fiscal_year, title, details, start_date, end_date, status)
SELECT 2026, 'Renouvellement des équipements informatiques', 'Étude et lancement de la procédure', '2026-11-01', '2026-12-15', 'planned'
WHERE NOT EXISTS (SELECT 1 FROM work_schedule WHERE fiscal_year = 2026 AND title = 'Renouvellement des équipements informatiques');

INSERT INTO user_reminders (user_id, title, details, reminder_at, importance, lead_minutes)
SELECT id, 'Vérifier les pièces contractuelles', 'Rappel de démonstration', '2026-10-15 09:00:00+01', 'normal', 30
FROM app_users WHERE email = 'admin@gct.tn'
AND NOT EXISTS (SELECT 1 FROM user_reminders WHERE title = 'Vérifier les pièces contractuelles' AND user_id = app_users.id);

INSERT INTO overtime_entries (user_id, employee_label, work_date, start_time, end_time, hours, comment, period)
SELECT id, 'Utilisateur de démonstration', '2026-10-01', '17:00', '19:00', 2, 'Exemple de saisie', '2026-10'
FROM app_users WHERE email = 'admin@gct.tn'
AND NOT EXISTS (SELECT 1 FROM overtime_entries WHERE employee_label = 'Utilisateur de démonstration' AND work_date = '2026-10-01');

INSERT INTO leave_requests (user_id, employee_label, leave_type, start_date, end_date, requested_days, holidays, status, requested_at)
SELECT id, 'Utilisateur de démonstration', 'Congé annuel', '2026-12-21', '2026-12-23', 3, 0, 'pending', '2026-10-01'
FROM app_users WHERE email = 'admin@gct.tn'
AND NOT EXISTS (SELECT 1 FROM leave_requests WHERE user_id = app_users.id AND leave_type = 'Congé annuel' AND start_date = '2026-12-21');
