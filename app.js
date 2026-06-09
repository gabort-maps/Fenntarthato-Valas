const {
  useState,
  useMemo,
  useEffect,
  useRef
} = React;

/* ---------- persistence (localStorage on GitHub; safe no-op in sandbox) ---------- */
const STORE_KEY = "fv_launch_control_v1";
const store = {
  read() {
    try {
      const v = localStorage.getItem(STORE_KEY);
      return v ? JSON.parse(v) : null;
    } catch (e) {
      return null;
    }
  },
  write(o) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(o));
    } catch (e) {}
  },
  clear() {
    try {
      localStorage.removeItem(STORE_KEY);
    } catch (e) {}
  }
};

/* ---------- reference data ---------- */
const GATES = [{
  key: "offer",
  name: "Offer locked",
  q: "Do we know exactly what we are selling, when, to whom and at what price?",
  owner: "Péter / Coordinator",
  rag: "red"
}, {
  key: "journey",
  name: "Client journey safe",
  q: "Can a client move from first contact to diagnostics, programme entry or referral safely?",
  owner: "Péter / Mentor lead / GDPR",
  rag: "red"
}, {
  key: "funnel",
  name: "Funnel technically working",
  q: "Can the funnel capture, nurture, sell, onboard and measure clients without manual chaos?",
  owner: "Netmarketing / Web / Finance",
  rag: "red"
}, {
  key: "delivery",
  name: "Delivery team ready",
  q: "Are Péter, Kata, Netmarketing, mentors and experts aligned on who does what?",
  owner: "Kata / Coordinator",
  rag: "amber"
}];
const GATE_BY_NAME = Object.fromEntries(GATES.map(g => [g.name, g.key]));
const WORKSTREAMS = [{
  id: 1,
  name: "Strategy & offer lock",
  gate: "offer",
  owner: "Péter / Coordinator",
  risk: "High"
}, {
  id: 2,
  name: "Client journey & service blueprint",
  gate: "journey",
  owner: "Péter / Kata",
  risk: "Medium"
}, {
  id: 3,
  name: "Diagnostics, triage & escalation",
  gate: "journey",
  owner: "Mentor lead / GDPR owner",
  risk: "High"
}, {
  id: 4,
  name: "Expert network & role governance",
  gate: "delivery",
  owner: "Kata / Coordinator",
  risk: "Medium"
}, {
  id: 5,
  name: "Marketing funnel & content production",
  gate: "funnel",
  owner: "Netmarketing / Péter",
  risk: "High"
}, {
  id: 6,
  name: "Community & webinar operations",
  gate: "funnel",
  owner: "Péter / Moderator",
  risk: "Medium"
}, {
  id: 7,
  name: "Technology, payments & automation",
  gate: "funnel",
  owner: "Web / Netmarketing / Finance",
  risk: "High"
}, {
  id: 8,
  name: "GDPR, consent & data handling",
  gate: "journey",
  owner: "Legal / GDPR owner",
  risk: "High"
}, {
  id: 9,
  name: "Sales, onboarding & customer support",
  gate: "delivery",
  owner: "Kata / Support owner",
  risk: "Medium"
}, {
  id: 10,
  name: "Measurement & post-launch control",
  gate: "funnel",
  owner: "Netmarketing / Coordinator",
  risk: "Low/Medium"
}];

// [id, workstream, gate, type, task, owner, priority, risk, status, dependency, output, offset, duration]
const RAW_TASKS = [["T001", "Strategy & offer lock", "offer", "Concrete", "Finalize group programme pricing", "Péter", "Critical", "High", "Open", "None", "Final price sheet", -56, 3], ["T002", "Strategy & offer lock", "offer", "Concrete", "Determine individual programme pricing", "Péter", "High", "Medium", "Open", "None", "Final individual offer", -56, 3], ["T003", "Strategy & offer lock", "offer", "Concrete", "Decide installment payment option", "Péter / Finance", "Critical", "High", "Open", "Pricing decision", "Payment terms", -55, 2], ["T004", "Strategy & offer lock", "offer", "Implied", "Reconcile conflicting launch dates", "Péter / Coordinator", "Critical", "High", "Open", "Leadership decision", "Single launch timeline", -56, 2], ["T005", "Strategy & offer lock", "offer", "Implied", "Reconcile conflicting pricing structures", "Péter / Coordinator", "Critical", "High", "Open", "Leadership decision", "Single pricing logic", -56, 2], ["T006", "Strategy & offer lock", "offer", "Implied", "Freeze offer claims for ads, webinar, landing pages and emails", "Péter / Netmarketing", "High", "High", "Open", "T001-T005", "Offer claim sheet", -52, 4], ["T007", "Client journey & service blueprint", "journey", "Concrete", "Map the 6-stage funnel from cold outreach to onboarding", "Coordinator / Netmarketing", "High", "Medium", "Open", "Offer lock", "Client journey map", -49, 5], ["T008", "Client journey & service blueprint", "journey", "Concrete", "Finalize 10-week curriculum and 6 modules", "Péter / Mentor lead", "High", "Medium", "Open", "Programme content", "Programme module map", -47, 7], ["T009", "Client journey & service blueprint", "journey", "Concrete", "Confirm 3-phase support model: Assessment, Preparation, Support", "Péter / Kata", "High", "Medium", "Open", "Service concept", "Service blueprint", -46, 4], ["T010", "Client journey & service blueprint", "journey", "Implied", "Create SOP for diagnostic-to-programme routing", "Coordinator / Mentor lead", "Critical", "High", "Open", "Triage rules", "Routing SOP", -42, 6], ["T011", "Client journey & service blueprint", "journey", "Implied", "Define mentor boundaries and exclusions", "Péter / Legal / Mentor lead", "Critical", "High", "Open", "Triage SOP", "Boundary note", -40, 5], ["T012", "Diagnostics, triage & escalation", "journey", "Concrete", "Administer 30–45 minute diagnostic questionnaire", "Mentors", "High", "Medium", "Open", "Questionnaire digitised", "Diagnostic workflow", -35, 5], ["T013", "Diagnostics, triage & escalation", "journey", "Concrete", "Screen for abuse and redirect to NANE / Eszter Alapítvány", "Mentor lead", "Critical", "High", "Open", "Triage SOP", "Abuse referral pathway", -35, 4], ["T014", "Diagnostics, triage & escalation", "journey", "Concrete", "Exclude acute clinical-crisis cases and refer to psychiatric care", "Mentor lead / Psychologist", "Critical", "High", "Open", "Triage SOP", "Clinical referral pathway", -35, 4], ["T015", "Diagnostics, triage & escalation", "journey", "Implied", "Train mentors on exact triage protocol and red flags", "Mentor lead", "Critical", "High", "Open", "Triage SOP", "Mentor training session", -28, 3], ["T016", "Diagnostics, triage & escalation", "journey", "Implied", "Convert Word questionnaire into secure digital format", "Web / GDPR owner", "Critical", "High", "Open", "Data workflow", "Secure digital questionnaire", -34, 8], ["T017", "Expert network & role governance", "delivery", "Concrete", "Coordinate external experts: lawyer, psychologist, child psychologist, mediator, financial adviser", "Kata / Coordinator", "High", "Medium", "Open", "Expert list", "Expert coordination plan", -35, 7], ["T018", "Expert network & role governance", "delivery", "Concrete", "Enforce 24-hour feedback/approval window for Péter on marketing materials", "Péter / Netmarketing", "High", "Medium", "Open", "Content calendar", "Approval workflow", -35, 30], ["T019", "Expert network & role governance", "delivery", "Implied", "Establish SLAs and availability schedules for named experts", "Coordinator", "High", "Medium", "Open", "Expert confirmation", "Expert SLA sheet", -32, 7], ["T020", "Expert network & role governance", "delivery", "Implied", "Brief experts on methodology and boundaries", "Péter / Coordinator", "High", "Medium", "Open", "Expert RACI", "Expert briefing pack", -28, 5], ["T021", "Marketing funnel & content production", "funnel", "Concrete", "Write, approve and schedule 18 social media posts", "Netmarketing / Péter", "High", "Medium", "Open", "Offer lock", "Approved posts", -35, 21], ["T022", "Marketing funnel & content production", "funnel", "Concrete", "Shoot, edit and subtitle 30 short-form videos", "Netmarketing / Videographer / Péter", "High", "High", "Open", "Script approval", "Video asset pack", -35, 24], ["T023", "Marketing funnel & content production", "funnel", "Concrete", "Publish 3 SEO blog articles", "Netmarketing", "Medium", "Low", "Open", "Content approval", "Published blogs", -28, 14], ["T024", "Marketing funnel & content production", "funnel", "Concrete", "Produce 5 new lead magnets", "Netmarketing / Péter", "High", "Medium", "Open", "Offer and audience priorities", "Lead magnet assets", -35, 21], ["T025", "Marketing funnel & content production", "funnel", "Concrete", "Launch Google Search and Meta Ads with A/B tested hooks", "Netmarketing PPC", "High", "High", "Open", "Tracking + landing pages", "Live campaigns", -7, 28], ["T026", "Marketing funnel & content production", "funnel", "Implied", "Create strict content scheduling grid and prioritise launch-critical assets", "Coordinator / Netmarketing", "High", "High", "Open", "Content inventory", "Launch-critical content calendar", -42, 7], ["T027", "Community & webinar operations", "funnel", "Concrete", "Manage closed Facebook group using 12-week calendar", "Péter / Community manager", "Medium", "Medium", "Open", "Group rules", "Community operations plan", -35, 84], ["T028", "Community & webinar operations", "funnel", "Concrete", "Host 60-minute webinar", "Péter", "High", "Medium", "Open", "Platform + deck + registration", "Webinar delivered", -12, 1], ["T029", "Community & webinar operations", "funnel", "Concrete", "Assign moderator to filter chat questions during webinar", "Marketing / Moderator", "Medium", "Medium", "Open", "Webinar runbook", "Moderator role confirmed", -13, 1], ["T030", "Community & webinar operations", "funnel", "Concrete", "Provide 48-hour webinar replay", "Netmarketing / Web", "Medium", "Low", "Open", "Recording and email sequence", "Replay live", -11, 3], ["T031", "Community & webinar operations", "funnel", "Implied", "Run webinar technical dry-run", "Coordinator / Netmarketing", "High", "Medium", "Open", "Platform selected", "Dry-run checklist", -16, 1], ["T032", "Technology, payments & automation", "funnel", "Concrete", "Set up general 5-day welcome email sequence in MailerLite", "Netmarketing / Web", "High", "Medium", "Open", "Email copy approved", "Automation live", -35, 5], ["T033", "Technology, payments & automation", "funnel", "Concrete", "Set up fathers' 5-day welcome email sequence in MailerLite", "Netmarketing / Web", "High", "Medium", "Open", "Email copy approved", "Automation live", -35, 5], ["T034", "Technology, payments & automation", "funnel", "Concrete", "Configure 6-email sales sequence", "Netmarketing / Web", "High", "Medium", "Open", "Offer lock", "Sales automation", -28, 5], ["T035", "Technology, payments & automation", "funnel", "Concrete", "Build lead magnet and programme landing pages", "Web / Netmarketing", "High", "High", "Open", "LP copy approved", "Landing pages live", -35, 14], ["T036", "Technology, payments & automation", "funnel", "Implied", "Connect payment gateway to course platform and email CRM", "Web / Finance", "Critical", "High", "Open", "Payment gateway selected", "Integrated checkout flow", -24, 7], ["T037", "Technology, payments & automation", "funnel", "Concrete", "Select payment gateway: SimplePay vs Stripe", "Web / Finance / Péter", "Critical", "High", "Open", "Finance decision", "Gateway decision", -56, 2], ["T038", "GDPR, consent & data handling", "journey", "Concrete", "Include GDPR text and unsubscribe links in all lead capture forms", "Netmarketing / Legal", "High", "Medium", "Open", "Legal review", "Compliant forms", -35, 7], ["T039", "GDPR, consent & data handling", "journey", "Concrete", "Secure explicit written consent for testimonials", "Netmarketing / Legal", "Medium", "Medium", "Open", "Consent wording", "Testimonial consent process", -28, 5], ["T040", "GDPR, consent & data handling", "journey", "Concrete", "Ensure client data is shared with experts strictly within GDPR rules", "GDPR owner / Coordinator", "Critical", "High", "Open", "Expert RACI + consent", "Expert data-sharing protocol", -35, 7], ["T041", "GDPR, consent & data handling", "journey", "Implied", "Establish secure encrypted storage and transmission protocol for diagnostics", "GDPR owner / Web", "Critical", "High", "Open", "Data owner appointed", "Data handling SOP", -42, 10], ["T042", "GDPR, consent & data handling", "journey", "Implied", "Legal review of Privacy Policy and Terms & Conditions", "Legal / GDPR owner", "Critical", "High", "Open", "Service workflow", "Legal sign-off", -35, 7], ["T043", "Sales, onboarding & customer support", "delivery", "Concrete", "Send 3–5 onboarding emails after purchase", "Kata / Netmarketing", "High", "Medium", "Open", "Payment trigger", "Onboarding sequence", 0, 3], ["T044", "Sales, onboarding & customer support", "delivery", "Concrete", "Host online kick-off live event", "Péter / Kata", "High", "Medium", "Open", "Participant list + programme access", "Kickoff delivered", 0, 1], ["T045", "Sales, onboarding & customer support", "delivery", "Concrete", "Answer Facebook group private messages within 24 hours", "Péter / Community support", "Medium", "Medium", "Open", "Support ownership", "Response SOP", 0, 14], ["T046", "Sales, onboarding & customer support", "delivery", "Concrete", "Process 2-week money-back guarantee if requested", "Kata / Finance", "Medium", "Medium", "Open", "Refund policy", "Refund workflow", 14, 7], ["T047", "Sales, onboarding & customer support", "delivery", "Implied", "Set up dedicated customer support inbox", "Kata / Support owner", "High", "Medium", "Open", "Support owner", "Support inbox live", -21, 4], ["T048", "Sales, onboarding & customer support", "delivery", "Concrete", "Populate e-learning platform with Week 1 content before kick-off", "Péter / Course admin", "High", "Medium", "Open", "Curriculum and platform", "Week 1 content live", -14, 7], ["T049", "Measurement & post-launch control", "funnel", "Concrete", "Configure UTM tracking for all URLs", "Netmarketing analytics", "High", "Medium", "Open", "URL list", "UTM framework", -28, 4], ["T050", "Measurement & post-launch control", "funnel", "Concrete", "Set up GA4 conversions", "Netmarketing analytics", "High", "Medium", "Open", "Landing pages", "GA4 conversion events", -28, 4], ["T051", "Measurement & post-launch control", "funnel", "Concrete", "Configure Meta Pixel events", "Netmarketing analytics", "High", "Medium", "Open", "Landing pages", "Pixel events", -28, 4], ["T052", "Measurement & post-launch control", "funnel", "Concrete", "Monitor KPIs: CPL < 4,500 Ft and email open rate >35%", "Netmarketing / Coordinator", "Medium", "Low", "Open", "Dashboard setup", "Weekly KPI report", -7, 35], ["T053", "Measurement & post-launch control", "funnel", "Concrete", "Send NPS survey 2 weeks after programme start", "Kata / Netmarketing", "Medium", "Low", "Open", "Participant list", "NPS results", 14, 1], ["T054", "Measurement & post-launch control", "funnel", "Implied", "Reallocate ad budget based on A/B test performance", "Netmarketing PPC", "Medium", "Low", "Open", "Campaign data", "Budget optimisation log", -1, 28]];
const taskFromRaw = r => ({
  id: r[0],
  workstream: r[1],
  gate: r[2],
  type: r[3],
  task: r[4],
  owner: r[5],
  priority: r[6],
  risk: r[7],
  status: r[8],
  dependency: r[9],
  output: r[10],
  offset: r[11],
  duration: r[12]
});
const RAW_DECISIONS = [["D001", "Final launch date", "Péter / Coordinator", "April 29 vs May 5 source conflict", "Full timeline remains unstable", "offer", "Open", "Immediate"], ["D002", "Group programme pricing", "Péter", "119k–149k Ft vs 160k Ft + modules", "Sales page, ads and webinar pitch cannot be finalised", "offer", "Open", "Immediate"], ["D003", "Individual programme pricing", "Péter", "Estimated 350k–450k Ft", "Premium offer cannot be communicated clearly", "offer", "Open", "Immediate"], ["D004", "Installment payment", "Péter / Finance", "Yes / No", "Checkout and conversion logic unclear", "offer", "Open", "Immediate"], ["D005", "Payment gateway", "Web / Finance / Péter", "SimplePay vs Stripe", "Sales funnel cannot be fully tested", "funnel", "Open", "Immediate"], ["D006", "Webinar platform", "Marketing / Operations", "Zoom Webinar vs StreamYard", "Registration, rehearsal and replay logic remain unstable", "funnel", "Open", "Immediate"], ["D007", "Diagnostic data owner", "Péter / Operations / Legal", "Not named in sources", "Sensitive-data risk remains unmanaged", "journey", "Open", "Immediate"], ["D008", "Triage escalation owner", "Péter / Mentor lead", "Not named in sources", "Client-safety risk remains unmanaged", "journey", "Open", "Immediate"], ["D009", "Expert RACI", "Coordinator / Kata", "Needs formalisation", "Referral and delivery risk", "delivery", "Open", "Short term"], ["D010", "Content approval process", "Péter / Netmarketing", "24-hour feedback window exists, needs operating discipline", "Production bottleneck risk", "delivery", "Open", "Short term"], ["D011", "Launch dashboard owner", "Netmarketing / Coordinator", "Needs explicit owner", "Weak learning loop", "funnel", "Open", "Short term"]];
const decisionFromRaw = r => ({
  id: r[0],
  decision: r[1],
  owner: r[2],
  conflict: r[3],
  impact: r[4],
  gate: r[5],
  status: r[6],
  window: r[7]
});
const RAW_RISKS = [["R001", "Conflicting launch dates", "Strategy", "High", "High", "Open", "Péter / Coordinator", "Decide one launch timeline and update all assets", "Different dates in emails/pages/ads", "Launch control meeting"], ["R002", "Conflicting pricing", "Strategy", "High", "High", "Open", "Péter", "Freeze pricing and rewrite all public claims", "Price mismatch in sales materials", "Péter decision"], ["R003", "Sensitive diagnostic data mishandled", "GDPR / Data", "Medium", "High", "Open", "GDPR owner", "Define secure storage, access and transfer protocol", "Diagnostics launched without data SOP", "Legal / GDPR escalation"], ["R004", "Abuse or crisis case handled as normal coaching", "Client safety", "Medium", "High", "Open", "Mentor lead", "Create triage SOP and referral pathway", "Red flags in intake without clear action", "Clinical/legal escalation"], ["R005", "Payment or email automation fails", "Technology", "Medium", "High", "Open", "Web / Netmarketing", "End-to-end test before ads go live", "Manual payment/access issues", "Tech lead"], ["R006", "Webinar technical failure", "Webinar", "Medium", "Medium", "Open", "Netmarketing / Moderator", "Dry-run platform, deck, recording and Q&A flow", "Platform instability or no moderator", "Operations lead"], ["R007", "Content production overload", "Marketing", "High", "High", "Open", "Netmarketing / Coordinator", "Prioritise launch-critical assets", "Late approvals, unedited videos", "Péter / Agency lead"], ["R008", "Expert availability unclear", "Delivery", "Medium", "Medium", "Open", "Kata / Coordinator", "Confirm capacity and referral SLAs", "Delayed expert response", "Expert governance meeting"], ["R009", "Client onboarding feels chaotic", "Delivery", "Medium", "Medium", "Open", "Kata / Support", "Support inbox, onboarding emails and FAQ", "Repeated access/payment questions", "Operations lead"], ["R010", "Tracking incomplete", "Measurement", "Medium", "Medium", "Open", "Netmarketing analytics", "Install and test GA4, Pixel, UTMs", "Unknown CPL/conversion source", "Agency analytics lead"]];
const riskFromRaw = r => ({
  id: r[0],
  risk: r[1],
  category: r[2],
  likelihood: r[3],
  severity: r[4],
  status: r[5],
  owner: r[6],
  mitigation: r[7],
  trigger: r[8],
  escalation: r[9]
});
const GDPR_CHECKS = [["G001", "Consent", "Marketing consent captured separately from diagnostic data consent", "GDPR owner / Web", "High"], ["G002", "Consent", "Unsubscribe links present in all marketing emails", "Netmarketing", "Medium"], ["G003", "Diagnostic data", "Secure storage location defined", "GDPR owner", "High"], ["G004", "Diagnostic data", "Access rights defined for mentors, operations and experts", "GDPR owner / Coordinator", "High"], ["G005", "Diagnostic data", "Secure transfer process to external experts defined", "GDPR owner", "High"], ["G006", "Diagnostic data", "Data retention and deletion process defined", "GDPR owner / Legal", "High"], ["G007", "Abuse triage", "Abuse red flags defined", "Mentor lead / Psychologist", "High"], ["G008", "Abuse triage", "Referral pathway to NANE / Eszter Alapítvány defined", "Mentor lead", "High"], ["G009", "Clinical triage", "Suicidal ideation / severe depression exclusion criteria defined", "Psychologist / Mentor lead", "High"], ["G010", "Child protection", "Child-safety boundaries and escalation rules defined", "Child psychologist / Legal", "High"], ["G011", "Legal boundary", "Disclaimer confirms no legal representation", "Legal", "Medium"], ["G012", "Therapy boundary", "Disclaimer confirms no psychotherapy", "Psychologist / Legal", "Medium"], ["G013", "Testimonials", "Written consent process for testimonials defined", "Netmarketing / Legal", "Medium"]];
const TECH_CHECKS = [["A001", "Landing pages", "Lead magnet landing pages built", "Web / Netmarketing", "High"], ["A002", "Landing pages", "Programme sales page built", "Web / Netmarketing", "High"], ["A003", "Email", "General welcome sequence active", "Netmarketing", "High"], ["A004", "Email", "Fathers welcome sequence active", "Netmarketing", "High"], ["A005", "Email", "Sales sequence active", "Netmarketing", "High"], ["A006", "Webinar", "Webinar platform selected and configured", "Marketing / Ops", "Critical"], ["A007", "Payment", "Payment gateway selected", "Web / Finance", "Critical"], ["A008", "Payment", "Checkout integrated with CRM/course platform", "Web / Finance", "Critical"], ["A009", "Course platform", "Week 1 content uploaded", "Course admin", "High"], ["A010", "Tracking", "UTM structure configured", "Analytics", "High"], ["A011", "Tracking", "GA4 conversion events configured", "Analytics", "High"], ["A012", "Tracking", "Meta Pixel events configured", "Analytics", "High"], ["A013", "Support", "Support inbox live", "Kata / Support", "Medium"], ["A014", "Refund", "Refund / guarantee workflow tested", "Finance / Support", "Medium"]];
const RUNBOOK = [["Day -14", "Readiness gate review", "Check offer, journey, funnel and delivery gates", "Coordinator", "Any red gate remains unresolved"], ["Day -10", "Funnel dry-run", "Test lead magnet, email trigger, webinar registration, checkout and onboarding", "Web / Netmarketing", "Any failed automation"], ["Day -7", "Content freeze", "Freeze launch-critical ads, emails, sales page, webinar deck", "Netmarketing / Péter", "Late copy changes"], ["Day -5", "GDPR/triage check", "Confirm diagnostic data and escalation protocols", "GDPR owner / Mentor lead", "No data owner or triage SOP"], ["Day -3", "Webinar rehearsal", "Technical dry-run with host, moderator, slides, Q&A and recording", "Péter / Moderator", "Replay or registration broken"], ["Day -1", "Go / no-go", "Confirm all critical gates are green/amber with mitigations", "Péter / Coordinator", "Any critical red item"], ["Launch day", "Campaign activation", "Turn on ads, monitor landing pages, support inbox and payments", "Netmarketing / Support", "Payment or page failures"], ["Launch +1", "First issue review", "Review leads, errors, support requests and tracking", "Coordinator / Netmarketing", "No data / high error volume"], ["Cart close -2", "Conversion push", "Reminder emails, monitor checkout, handle support questions", "Netmarketing / Support", "Checkout support spikes"], ["Programme start", "Onboarding and kickoff", "Confirm participants, access, group rules and kickoff delivery", "Kata / Péter", "Access issues"], ["Start +14", "NPS and lessons", "Send NPS, review early delivery issues", "Kata / Coordinator", "Low NPS or recurring complaints"]];
const JOURNEY = [["1. Awareness", "Sees content, ad, blog, video or podcast", "Drive traffic to lead magnet or community", "Netmarketing / Péter", "Claims must match boundaries"], ["2. Lead magnet", "Downloads free resource", "Capture consent and trigger email sequence", "Netmarketing / Web", "GDPR consent required"], ["3. Nurturing", "Reads emails, joins Facebook group", "Build trust and educate", "Péter / Community manager", "Community moderation"], ["4. Diagnostic", "Completes 30–45 minute questionnaire", "Assess emotional, legal, financial, parenting and risk baseline", "Mentor lead", "Sensitive data + triage"], ["5. Triage / routing", "Receives next-step recommendation", "Route to group, individual, expert or external support", "Mentor lead / Coordinator", "Abuse/clinical red flags"], ["6. Webinar", "Registers and attends live webinar", "Deliver value and pitch programme", "Péter / Moderator", "Tech and sales clarity"], ["7. Purchase", "Buys group or individual programme", "Process payment, confirmation and access", "Web / Finance / Kata", "Payment automation"], ["8. Onboarding", "Receives emails and joins kickoff", "Set expectations, access, rules and support routes", "Kata / Péter", "Client anxiety/support"], ["9. Delivery", "Attends sessions / workshops", "Provide group or individual preparation", "Péter / Mentors / Experts", "Role boundaries"], ["10. Learning loop", "Completes NPS and feedback", "Measure experience and improve funnel/service", "Kata / Netmarketing", "Consent for testimonials"]];
const STATUS_OPTS = ["Open", "In progress", "At risk", "Blocked", "Done", "Deferred"];
const PRIORITY_OPTS = ["Critical", "High", "Medium", "Low"];

// Editable owner / team directory. Owners on tasks, decisions and risks are chosen from this.
const TEAM_DEF = [["P01", "Péter", "Founder, lead mentor"], ["P02", "Kata", "Operations & client success"], ["P03", "Coordinator", "Launch coordinator"], ["P04", "Netmarketing", "Marketing agency"], ["P05", "Web", "Web & development"], ["P06", "Finance", "Finance"], ["P07", "Legal", "Legal counsel"], ["P08", "GDPR owner", "Data protection"], ["P09", "Mentor lead", "Mentor team lead"], ["P10", "Psychologist", "Clinical screening"], ["P11", "Child psychologist", "Child protection"], ["P12", "Moderator", "Webinar / community moderation"], ["P13", "Community manager", "Facebook group"], ["P14", "Support owner", "Customer support"], ["P15", "Course admin", "E-learning platform"], ["P16", "Analytics", "Tracking & measurement"], ["P17", "Videographer", "Video production"]];
const teamFromRaw = r => ({
  id: r[0],
  name: r[1],
  role: r[2]
});
function chipStyle(on) {
  return {
    border: on ? "1px solid var(--sage)" : "1px solid var(--line-strong)",
    background: on ? "var(--sage)" : "transparent",
    color: on ? "#fff" : "var(--ink-soft)",
    borderRadius: 999,
    padding: "4px 10px",
    fontSize: 12,
    cursor: "pointer",
    fontFamily: "inherit"
  };
}
function OwnerPicker({
  value,
  team,
  onChange
}) {
  const sel = (value || "").split(" / ").map(s => s.trim()).filter(Boolean);
  const names = team.map(t => t.name);
  const extras = sel.filter(s => !names.includes(s));
  const toggle = name => {
    const set = new Set(sel);
    set.has(name) ? set.delete(name) : set.add(name);
    onChange(Array.from(set).join(" / "));
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-1"
  }, team.map(t => {
    const on = sel.includes(t.name);
    return /*#__PURE__*/React.createElement("button", {
      key: t.id,
      type: "button",
      onClick: () => toggle(t.name),
      className: "ring-focus",
      style: chipStyle(on)
    }, t.name);
  }), extras.map(n => /*#__PURE__*/React.createElement("button", {
    key: n,
    type: "button",
    onClick: () => toggle(n),
    className: "ring-focus",
    style: {
      ...chipStyle(true),
      background: "var(--amber)",
      border: "1px solid var(--amber)"
    }
  }, n, " \u2715")), team.length === 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: "var(--ink-soft)"
    }
  }, "Add people on the Team tab first."));
}

/* ---------- helpers ---------- */
const DAY = 86400000;
const fmt = d => d.toLocaleDateString("en-GB", {
  day: "2-digit",
  month: "short"
});
const fmtFull = d => d.toLocaleDateString("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric"
});
const addDays = (d, n) => new Date(d.getTime() + n * DAY);
const startOfDay = d => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
function statusStyle(s) {
  switch (s) {
    case "Done":
      return {
        bg: "var(--green-tint)",
        fg: "var(--green)"
      };
    case "In progress":
      return {
        bg: "var(--blue-tint)",
        fg: "var(--blue)"
      };
    case "At risk":
      return {
        bg: "var(--amber-tint)",
        fg: "var(--amber)"
      };
    case "Blocked":
      return {
        bg: "var(--red-tint)",
        fg: "var(--red)"
      };
    case "Deferred":
      return {
        bg: "var(--gray-tint)",
        fg: "var(--gray)"
      };
    default:
      return {
        bg: "var(--gray-tint)",
        fg: "var(--ink-soft)"
      };
  }
}
function ragStyle(r) {
  if (r === "green") return {
    bg: "var(--green-tint)",
    fg: "var(--green)",
    label: "Green"
  };
  if (r === "amber") return {
    bg: "var(--amber-tint)",
    fg: "var(--amber)",
    label: "Amber"
  };
  return {
    bg: "var(--red-tint)",
    fg: "var(--red)",
    label: "Red"
  };
}
function sevDot(level) {
  const c = level === "High" ? "var(--red)" : level === "Medium" ? "var(--amber)" : "var(--green)";
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-block",
      width: 8,
      height: 8,
      borderRadius: 9,
      background: c,
      marginRight: 6
    }
  });
}

/* ---------- small UI atoms ---------- */
function Pill({
  children,
  bg,
  fg
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: "tabnum",
    style: {
      background: bg,
      color: fg,
      padding: "2px 9px",
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 600,
      whiteSpace: "nowrap"
    }
  }, children);
}
function StatusSelect({
  value,
  onChange,
  options = STATUS_OPTS
}) {
  const st = statusStyle(value);
  return /*#__PURE__*/React.createElement("select", {
    value: value,
    onChange: e => onChange(e.target.value),
    className: "ring-focus",
    style: {
      background: st.bg,
      color: st.fg,
      border: "none",
      borderRadius: 999,
      padding: "3px 8px",
      fontSize: 11,
      fontWeight: 600,
      cursor: "pointer",
      appearance: "none"
    }
  }, options.map(o => /*#__PURE__*/React.createElement("option", {
    key: o,
    value: o,
    style: {
      background: "#fff",
      color: "var(--ink)"
    }
  }, o)));
}

/* ---------- Dashboard ---------- */
function GateCard({
  gate,
  computed,
  override,
  onOverride,
  metrics
}) {
  const rag = override && override !== "auto" ? override : computed;
  const st = ragStyle(rag);
  const auto = !override || override === "auto";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--card)",
      border: "1px solid var(--line)",
      borderTop: `3px solid ${st.fg}`,
      borderRadius: 14,
      padding: "16px 16px 14px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-start justify-between gap-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-display",
    style: {
      fontSize: 17,
      fontWeight: 600,
      lineHeight: 1.15
    }
  }, gate.name), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-1"
  }, /*#__PURE__*/React.createElement("span", {
    title: "Colour set automatically from tasks & decisions",
    style: {
      background: st.bg,
      color: st.fg,
      borderRadius: 999,
      padding: "3px 9px",
      fontSize: 11,
      fontWeight: 700
    }
  }, st.label, auto ? "" : " •"), /*#__PURE__*/React.createElement("select", {
    value: override || "auto",
    onChange: e => onOverride(e.target.value),
    title: "Auto = computed from tasks and decisions",
    className: "ring-focus",
    style: {
      background: "transparent",
      color: "var(--ink-soft)",
      border: "1px solid var(--line-strong)",
      borderRadius: 999,
      padding: "3px 6px",
      fontSize: 10.5,
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "auto"
  }, "Auto"), /*#__PURE__*/React.createElement("option", {
    value: "red"
  }, "Red"), /*#__PURE__*/React.createElement("option", {
    value: "amber"
  }, "Amber"), /*#__PURE__*/React.createElement("option", {
    value: "green"
  }, "Green")))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: "var(--ink-soft)",
      margin: "7px 0 12px",
      lineHeight: 1.4
    }
  }, gate.q), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 6,
      background: "var(--line)",
      borderRadius: 6,
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${metrics.pct}%`,
      height: "100%",
      background: st.fg,
      transition: "width .4s"
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between tabnum",
    style: {
      fontSize: 11,
      color: "var(--ink-soft)",
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement("span", null, metrics.done, "/", metrics.total, " tasks done"), /*#__PURE__*/React.createElement("span", null, metrics.openDec, " open dec \xB7 ", metrics.blocked, " blocked")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "var(--ink-soft)",
      marginTop: 8,
      borderTop: "1px dashed var(--line)",
      paddingTop: 7
    }
  }, "Owner \xB7 ", gate.owner));
}

// Automatic gate colour from the underlying work.
function computeGate(key, tasks, decisions) {
  const t = tasks.filter(x => x.gate === key);
  const total = t.length,
    done = t.filter(x => x.status === "Done").length;
  const pct = total ? done / total * 100 : 0;
  const blocked = t.filter(x => x.status === "Blocked").length;
  const openImm = decisions.filter(d => d.gate === key && d.window === "Immediate" && d.status !== "Done").length;
  if (total > 0 && pct >= 100 && openImm === 0) return "green";
  if (openImm > 0 || blocked > 0) return "red";
  return "amber";
}
function Stat({
  label,
  value,
  sub,
  accent
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--card)",
      border: "1px solid var(--line)",
      borderRadius: 14,
      padding: "14px 16px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      letterSpacing: ".06em",
      textTransform: "uppercase",
      color: "var(--ink-soft)"
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    className: "font-display tabnum",
    style: {
      fontSize: 30,
      fontWeight: 600,
      color: accent || "var(--ink)",
      lineHeight: 1.1,
      marginTop: 4
    }
  }, value), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: "var(--ink-soft)",
      marginTop: 2
    }
  }, sub));
}
function Dashboard({
  state,
  setState,
  milestones,
  tasks
}) {
  const [editMs, setEditMs] = useState(false);
  const gateMetrics = key => {
    const t = tasks.filter(x => x.gate === key);
    const done = t.filter(x => x.status === "Done").length;
    const openDec = state.decisions.filter(d => d.gate === key && d.status !== "Done").length;
    const blocked = t.filter(x => x.status === "Blocked").length;
    return {
      total: t.length,
      done,
      pct: t.length ? Math.round(done / t.length * 100) : 0,
      openDec,
      blocked
    };
  };
  const overall = Math.round(tasks.filter(t => t.status === "Done").length / Math.max(tasks.length, 1) * 100);
  const openDecisions = state.decisions.filter(d => d.status !== "Done").length;
  const highRisks = state.risks.filter(r => r.severity === "High" && r.status !== "Done").length;
  const blocked = tasks.filter(t => t.status === "Blocked").length;
  const effRag = g => state.gateOverride[g] && state.gateOverride[g] !== "auto" ? state.gateOverride[g] : computeGate(g, tasks, state.decisions);
  const redGates = GATES.filter(g => effRag(g.key) === "red").length;
  const setMs = (key, offset) => setState(s => ({
    ...s,
    milestones: s.milestones.map(m => m.key === key ? {
      ...m,
      offset: offset === "" ? 0 : Number(offset)
    } : m)
  }));
  return /*#__PURE__*/React.createElement("div", {
    className: "space-y-6"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--card)",
      border: "1px solid var(--line)",
      borderRadius: 16,
      padding: "18px 20px",
      borderLeft: "4px solid var(--sage)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      letterSpacing: ".08em",
      textTransform: "uppercase",
      color: "var(--sage)"
    }
  }, "Launch objective"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "6px 0 0",
      fontSize: 14.5,
      lineHeight: 1.5,
      maxWidth: 760
    }
  }, "Launch ", /*#__PURE__*/React.createElement("b", null, "Fenntarthat\xF3 V\xE1l\xE1s"), " in Hungary as a structured divorce-preparation support system \u2014 connecting audience acquisition, diagnostic intake, safe triage, expert-supported preparation and paid programme delivery."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      fontSize: 12.5,
      color: "var(--red)",
      fontWeight: 600
    }
  }, "Operating rule \xB7 Do not scale marketing before the offer, client journey, funnel and delivery gates pass.")), /*#__PURE__*/React.createElement("div", {
    className: "grid gap-4",
    style: {
      gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))"
    }
  }, /*#__PURE__*/React.createElement(Stat, {
    label: "Overall readiness",
    value: overall + "%",
    sub: `${tasks.filter(t => t.status === "Done").length} of ${tasks.length} tasks done`,
    accent: "var(--sage)"
  }), /*#__PURE__*/React.createElement(Stat, {
    label: "Red gates",
    value: redGates,
    sub: "must reach amber/green",
    accent: redGates ? "var(--red)" : "var(--green)"
  }), /*#__PURE__*/React.createElement(Stat, {
    label: "Open decisions",
    value: openDecisions,
    sub: "blocking execution",
    accent: openDecisions ? "var(--amber)" : "var(--green)"
  }), /*#__PURE__*/React.createElement(Stat, {
    label: "High risks",
    value: highRisks,
    sub: "severity = High, open",
    accent: highRisks ? "var(--red)" : "var(--green)"
  }), /*#__PURE__*/React.createElement(Stat, {
    label: "Blocked tasks",
    value: blocked,
    sub: "need unblocking",
    accent: blocked ? "var(--red)" : "var(--green)"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SectionTitle, null, "The four launch gates"), /*#__PURE__*/React.createElement("div", {
    className: "grid gap-4",
    style: {
      gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))"
    }
  }, GATES.map(g => /*#__PURE__*/React.createElement(GateCard, {
    key: g.key,
    gate: g,
    computed: computeGate(g.key, tasks, state.decisions),
    override: state.gateOverride[g.key],
    onOverride: v => setState(s => ({
      ...s,
      gateOverride: {
        ...s.gateOverride,
        [g.key]: v
      }
    })),
    metrics: gateMetrics(g.key)
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: "var(--ink-soft)",
      marginTop: 8
    }
  }, "Gate colours are computed automatically: ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: "var(--red)"
    }
  }, "Red"), " if an immediate decision is open or a task is blocked, ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: "var(--green)"
    }
  }, "Green"), " once all its tasks are done with no open immediate decision, otherwise ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: "var(--amber)"
    }
  }, "Amber"), ". Use the small dropdown to override.")), /*#__PURE__*/React.createElement("div", {
    className: "grid gap-5",
    style: {
      gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SectionTitle, null, "Immediate decisions"), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--card)",
      border: "1px solid var(--line)",
      borderRadius: 14,
      overflow: "hidden"
    }
  }, state.decisions.filter(d => d.window === "Immediate" && d.status !== "Done").map((d, i) => /*#__PURE__*/React.createElement("div", {
    key: d.id,
    className: "flex items-center justify-between gap-3",
    style: {
      padding: "10px 14px",
      borderTop: i ? "1px solid var(--line)" : "none"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      fontWeight: 600
    }
  }, d.decision), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: "var(--ink-soft)"
    }
  }, d.owner)), /*#__PURE__*/React.createElement(Pill, {
    bg: "var(--red-tint)",
    fg: "var(--red)"
  }, d.id))), state.decisions.filter(d => d.window === "Immediate" && d.status !== "Done").length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "14px",
      fontSize: 12.5,
      color: "var(--green)"
    }
  }, "No open immediate decisions."))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SectionTitle, null, "Top high-severity risks"), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--card)",
      border: "1px solid var(--line)",
      borderRadius: 14,
      overflow: "hidden"
    }
  }, state.risks.filter(r => r.severity === "High" && r.status !== "Done").map((r, i) => /*#__PURE__*/React.createElement("div", {
    key: r.id,
    className: "flex items-start justify-between gap-3",
    style: {
      padding: "10px 14px",
      borderTop: i ? "1px solid var(--line)" : "none"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      fontWeight: 600
    }
  }, sevDot(r.severity), r.risk), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: "var(--ink-soft)",
      marginLeft: 14
    }
  }, r.mitigation)), /*#__PURE__*/React.createElement(Pill, {
    bg: "var(--gray-tint)",
    fg: "var(--ink-soft)"
  }, r.owner.split(" / ")[0]))), state.risks.filter(r => r.severity === "High" && r.status !== "Done").length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "14px",
      fontSize: 12.5,
      color: "var(--green)"
    }
  }, "No open high-severity risks.")))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between",
    style: {
      marginBottom: 11
    }
  }, /*#__PURE__*/React.createElement(SectionTitle, null, "Key milestones"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setEditMs(v => !v),
    className: "ring-focus",
    style: {
      border: "1px solid var(--line-strong)",
      background: editMs ? "var(--sage)" : "transparent",
      color: editMs ? "#fff" : "var(--ink-soft)",
      borderRadius: 8,
      padding: "5px 11px",
      fontSize: 12,
      cursor: "pointer",
      fontFamily: "inherit"
    }
  }, editMs ? "Done" : "Edit timing")), /*#__PURE__*/React.createElement("div", {
    className: "grid gap-3",
    style: {
      gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))"
    }
  }, milestones.map(m => /*#__PURE__*/React.createElement("div", {
    key: m.key,
    style: {
      background: "var(--card)",
      border: "1px solid var(--line)",
      borderRadius: 12,
      padding: "11px 13px",
      borderTop: `3px solid ${m.color}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: "var(--ink-soft)"
    }
  }, m.label), editMs ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: m.offset,
    onChange: e => setMs(m.key, e.target.value),
    className: "ring-focus tabnum",
    style: {
      width: "100%",
      background: "#fff",
      border: "1px solid var(--line-strong)",
      borderRadius: 8,
      padding: "5px 8px",
      fontSize: 13
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "tabnum",
    style: {
      fontSize: 11,
      color: "var(--ink-soft)",
      marginTop: 4
    }
  }, "days from launch \xB7 ", fmt(m.date))) : /*#__PURE__*/React.createElement("div", {
    className: "font-display tabnum",
    style: {
      fontSize: 18,
      fontWeight: 600,
      marginTop: 2
    }
  }, fmt(m.date)))))));
}
function SectionTitle({
  children
}) {
  return /*#__PURE__*/React.createElement("h2", {
    className: "font-display",
    style: {
      fontSize: 14,
      fontWeight: 600,
      letterSpacing: ".04em",
      textTransform: "uppercase",
      color: "var(--sage-deep)",
      margin: "0 0 11px"
    }
  }, children);
}

/* ---------- Tasks ---------- */
function TasksView({
  state,
  setState,
  tasks,
  launchDate
}) {
  const [q, setQ] = useState("");
  const [gate, setGate] = useState("all");
  const [stat, setStat] = useState("all");
  const [owner, setOwner] = useState("all");
  const [sortKey, setSortKey] = useState("start");
  const owners = useMemo(() => ["all", ...Array.from(new Set(tasks.map(t => t.owner))).sort()], [tasks]);
  const gateRag = g => state.gateOverride[g] && state.gateOverride[g] !== "auto" ? state.gateOverride[g] : computeGate(g, tasks, state.decisions);
  const filtered = useMemo(() => {
    let r = tasks.filter(t => {
      if (gate !== "all" && t.gate !== gate) return false;
      if (stat !== "all" && t.status !== stat) return false;
      if (owner !== "all" && t.owner !== owner) return false;
      if (q && !(t.task + " " + t.id + " " + t.owner + " " + t.workstream).toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
    r.sort((a, b) => sortKey === "start" ? a.start - b.start : sortKey === "due" ? a.due - b.due : sortKey === "priority" ? PRIORITY_OPTS.indexOf(a.priority) - PRIORITY_OPTS.indexOf(b.priority) : a.id.localeCompare(b.id));
    return r;
  }, [tasks, gate, stat, owner, q, sortKey]);
  const [editing, setEditing] = useState(null); // raw task object being edited
  const [isNew, setIsNew] = useState(false);
  const setTask = (id, patch) => setState(s => ({
    ...s,
    tasks: s.tasks.map(t => t.id === id ? {
      ...t,
      ...patch
    } : t)
  }));
  const deleteTask = id => setState(s => ({
    ...s,
    tasks: s.tasks.filter(t => t.id !== id)
  }));
  const saveTask = obj => {
    const {
      start,
      due,
      ...raw
    } = obj; // never persist computed dates
    setState(s => s.tasks.some(t => t.id === raw.id) ? {
      ...s,
      tasks: s.tasks.map(t => t.id === raw.id ? raw : t)
    } : {
      ...s,
      tasks: [...s.tasks, raw]
    });
    setEditing(null);
  };
  const nextId = () => {
    const n = tasks.reduce((m, t) => {
      const x = parseInt(String(t.id).replace(/\D/g, ""), 10);
      return isNaN(x) ? m : Math.max(m, x);
    }, 0);
    return "T" + String(n + 1).padStart(3, "0");
  };
  const openNew = () => {
    setIsNew(true);
    setEditing({
      id: nextId(),
      workstream: WORKSTREAMS[0].name,
      gate: WORKSTREAMS[0].gate,
      type: "Concrete",
      task: "",
      owner: "",
      priority: "High",
      risk: "Medium",
      status: "Open",
      dependency: "None",
      output: "",
      offset: -35,
      duration: 5
    });
  };
  const openEdit = t => {
    const {
      start,
      due,
      ...raw
    } = t;
    setIsNew(false);
    setEditing(raw);
  };
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-2 items-center",
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: "Search tasks\u2026",
    className: "ring-focus",
    style: {
      flex: "1 1 160px",
      minWidth: 140,
      background: "var(--card)",
      border: "1px solid var(--line-strong)",
      borderRadius: 10,
      padding: "8px 12px",
      fontSize: 13
    }
  }), /*#__PURE__*/React.createElement(Select, {
    value: gate,
    onChange: setGate,
    opts: [["all", "All gates"], ...GATES.map(g => [g.key, g.name])]
  }), /*#__PURE__*/React.createElement(Select, {
    value: stat,
    onChange: setStat,
    opts: [["all", "All statuses"], ...STATUS_OPTS.map(s => [s, s])]
  }), /*#__PURE__*/React.createElement(Select, {
    value: owner,
    onChange: setOwner,
    opts: owners.map(o => [o, o === "all" ? "All owners" : o])
  }), /*#__PURE__*/React.createElement(Select, {
    value: sortKey,
    onChange: setSortKey,
    opts: [["start", "Sort: start"], ["due", "Sort: due"], ["priority", "Sort: priority"], ["id", "Sort: ID"]]
  }), /*#__PURE__*/React.createElement("button", {
    onClick: openNew,
    className: "ring-focus",
    style: {
      marginLeft: "auto",
      background: "var(--sage)",
      color: "#fff",
      border: "none",
      borderRadius: 10,
      padding: "8px 14px",
      fontSize: 13,
      fontWeight: 600,
      cursor: "pointer",
      fontFamily: "inherit",
      whiteSpace: "nowrap"
    }
  }, "+ Add task")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "var(--ink-soft)",
      marginBottom: 8
    }
  }, filtered.length, " of ", tasks.length, " tasks \xB7 click a row's pencil to edit text, owner, priority and timing"), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--card)",
      border: "1px solid var(--line)",
      borderRadius: 14,
      maxHeight: "70vh",
      overflow: "auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      position: "sticky",
      top: 0,
      zIndex: 5,
      gridTemplateColumns: "50px 1fr 140px 70px 78px 112px 34px",
      gap: 8,
      padding: "9px 14px",
      borderBottom: "1px solid var(--line-strong)",
      fontSize: 10.5,
      letterSpacing: ".05em",
      textTransform: "uppercase",
      color: "var(--ink-soft)",
      fontWeight: 600,
      background: "var(--card)"
    }
  }, /*#__PURE__*/React.createElement("span", null, "ID"), /*#__PURE__*/React.createElement("span", null, "Task"), /*#__PURE__*/React.createElement("span", null, "Owner"), /*#__PURE__*/React.createElement("span", null, "Prio"), /*#__PURE__*/React.createElement("span", null, "Due"), /*#__PURE__*/React.createElement("span", null, "Status"), /*#__PURE__*/React.createElement("span", null)), filtered.map((t, i) => /*#__PURE__*/React.createElement("div", {
    key: t.id,
    className: "grid items-center",
    style: {
      gridTemplateColumns: "50px 1fr 140px 70px 78px 112px 34px",
      gap: 8,
      padding: "10px 14px",
      borderTop: i ? "1px solid var(--line)" : "none"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "tabnum",
    style: {
      fontSize: 11.5,
      color: "var(--ink-soft)",
      fontWeight: 600
    }
  }, t.id), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      lineHeight: 1.3
    }
  }, t.task), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "var(--ink-soft)",
      marginTop: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: ragStyle(gateRag(t.gate)).fg
    }
  }, "\u25CF"), " ", GATES.find(g => g.key === t.gate)?.name, " \xB7 ", t.workstream, " \xB7 ", fmt(t.start), "\u2192", fmt(t.due), " (", t.duration, "d)")), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: "var(--ink-soft)"
    }
  }, t.owner), /*#__PURE__*/React.createElement(Pill, {
    bg: t.priority === "Critical" ? "var(--red-tint)" : t.priority === "High" ? "var(--amber-tint)" : "var(--gray-tint)",
    fg: t.priority === "Critical" ? "var(--red)" : t.priority === "High" ? "var(--amber)" : "var(--ink-soft)"
  }, t.priority), /*#__PURE__*/React.createElement("span", {
    className: "tabnum",
    style: {
      fontSize: 12
    }
  }, fmt(t.due)), /*#__PURE__*/React.createElement(StatusSelect, {
    value: t.status,
    onChange: v => setTask(t.id, {
      status: v
    })
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => openEdit(t),
    title: "Edit task",
    className: "ring-focus",
    style: {
      border: "1px solid var(--line-strong)",
      background: "transparent",
      borderRadius: 8,
      width: 30,
      height: 28,
      cursor: "pointer",
      fontSize: 13,
      color: "var(--ink-soft)"
    }
  }, "\u270E")))), editing && /*#__PURE__*/React.createElement(TaskEditor, {
    task: editing,
    isNew: isNew,
    launchDate: launchDate,
    team: state.team,
    onSave: saveTask,
    onDelete: id => {
      deleteTask(id);
      setEditing(null);
    },
    onClose: () => setEditing(null)
  }));
}
function TaskEditor({
  task,
  isNew,
  launchDate,
  team,
  onSave,
  onDelete,
  onClose
}) {
  const [d, setD] = useState(task);
  const set = (k, v) => setD(p => ({
    ...p,
    [k]: v
  }));
  const onWs = name => {
    const w = WORKSTREAMS.find(x => x.name === name);
    setD(p => ({
      ...p,
      workstream: name,
      gate: w ? w.gate : p.gate
    }));
  };
  const off = Number(d.offset) || 0,
    dur = Math.max(1, Number(d.duration) || 1);
  const start = addDays(launchDate, off),
    due = addDays(start, dur - 1);
  const lab = {
    fontSize: 11,
    letterSpacing: ".04em",
    textTransform: "uppercase",
    color: "var(--ink-soft)",
    fontWeight: 600,
    display: "block",
    marginBottom: 4
  };
  const inp = {
    width: "100%",
    background: "#fff",
    border: "1px solid var(--line-strong)",
    borderRadius: 9,
    padding: "8px 10px",
    fontSize: 13,
    fontFamily: "inherit"
  };
  const canSave = (d.task || "").trim().length > 0;
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(31,45,43,.45)",
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "center",
      padding: "28px 14px",
      zIndex: 50,
      overflowY: "auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      background: "var(--card)",
      borderRadius: 16,
      maxWidth: 560,
      width: "100%",
      border: "1px solid var(--line-strong)",
      boxShadow: "0 24px 60px rgba(0,0,0,.25)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between",
    style: {
      padding: "15px 18px",
      borderBottom: "1px solid var(--line)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-display",
    style: {
      fontSize: 18,
      fontWeight: 600
    }
  }, isNew ? "New task" : "Edit task " + d.id), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    className: "ring-focus",
    style: {
      border: "none",
      background: "transparent",
      fontSize: 20,
      cursor: "pointer",
      color: "var(--ink-soft)",
      lineHeight: 1
    }
  }, "\xD7")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "16px 18px",
      display: "grid",
      gap: 13
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: lab
  }, "Task"), /*#__PURE__*/React.createElement("textarea", {
    value: d.task,
    onChange: e => set("task", e.target.value),
    rows: 2,
    className: "ring-focus",
    style: {
      ...inp,
      resize: "vertical"
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "grid gap-3",
    style: {
      gridTemplateColumns: "1fr 1fr"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: lab
  }, "Workstream"), /*#__PURE__*/React.createElement("select", {
    value: d.workstream,
    onChange: e => onWs(e.target.value),
    className: "ring-focus",
    style: inp
  }, WORKSTREAMS.map(w => /*#__PURE__*/React.createElement("option", {
    key: w.id,
    value: w.name
  }, w.name)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: lab
  }, "Gate (auto)"), /*#__PURE__*/React.createElement("input", {
    value: GATES.find(g => g.key === d.gate)?.name || "",
    readOnly: true,
    style: {
      ...inp,
      background: "var(--paper)",
      color: "var(--ink-soft)"
    }
  }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: lab
  }, "Owner(s) \u2014 tap to select from the team"), /*#__PURE__*/React.createElement(OwnerPicker, {
    value: d.owner,
    team: team,
    onChange: v => set("owner", v)
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: lab
  }, "Dependency"), /*#__PURE__*/React.createElement("input", {
    value: d.dependency,
    onChange: e => set("dependency", e.target.value),
    className: "ring-focus",
    style: inp
  })), /*#__PURE__*/React.createElement("div", {
    className: "grid gap-3",
    style: {
      gridTemplateColumns: "1fr 1fr 1fr"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: lab
  }, "Priority"), /*#__PURE__*/React.createElement("select", {
    value: d.priority,
    onChange: e => set("priority", e.target.value),
    className: "ring-focus",
    style: inp
  }, PRIORITY_OPTS.map(o => /*#__PURE__*/React.createElement("option", {
    key: o
  }, o)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: lab
  }, "Risk"), /*#__PURE__*/React.createElement("select", {
    value: d.risk,
    onChange: e => set("risk", e.target.value),
    className: "ring-focus",
    style: inp
  }, ["High", "Medium", "Low"].map(o => /*#__PURE__*/React.createElement("option", {
    key: o
  }, o)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: lab
  }, "Status"), /*#__PURE__*/React.createElement("select", {
    value: d.status,
    onChange: e => set("status", e.target.value),
    className: "ring-focus",
    style: inp
  }, STATUS_OPTS.map(o => /*#__PURE__*/React.createElement("option", {
    key: o
  }, o))))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: lab
  }, "Output / deliverable"), /*#__PURE__*/React.createElement("input", {
    value: d.output,
    onChange: e => set("output", e.target.value),
    className: "ring-focus",
    style: inp
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--sage-tint)",
      borderRadius: 11,
      padding: "12px 13px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: "var(--sage-deep)",
      fontWeight: 600,
      marginBottom: 9
    }
  }, "Timing \u2014 relative to the launch date, so it stays correct if the launch moves"), /*#__PURE__*/React.createElement("div", {
    className: "grid gap-3",
    style: {
      gridTemplateColumns: "1fr 1fr"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: lab
  }, "Start (days from launch, \u2212 = before)"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: d.offset,
    onChange: e => set("offset", e.target.value),
    className: "ring-focus tabnum",
    style: inp
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: lab
  }, "Duration (days)"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "1",
    value: d.duration,
    onChange: e => set("duration", e.target.value),
    className: "ring-focus tabnum",
    style: inp
  }))), /*#__PURE__*/React.createElement("div", {
    className: "tabnum",
    style: {
      fontSize: 12.5,
      marginTop: 9,
      color: "var(--sage-deep)"
    }
  }, "\u2192 ", fmtFull(start), " \xA0to\xA0 ", fmtFull(due)))), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between",
    style: {
      padding: "13px 18px",
      borderTop: "1px solid var(--line)"
    }
  }, !isNew ? /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      if (confirm("Delete " + d.id + "?")) onDelete(d.id);
    },
    className: "ring-focus",
    style: {
      border: "1px solid var(--red)",
      background: "transparent",
      color: "var(--red)",
      borderRadius: 9,
      padding: "8px 13px",
      fontSize: 13,
      cursor: "pointer",
      fontFamily: "inherit"
    }
  }, "Delete") : /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    className: "ring-focus",
    style: {
      border: "1px solid var(--line-strong)",
      background: "transparent",
      borderRadius: 9,
      padding: "8px 14px",
      fontSize: 13,
      cursor: "pointer",
      fontFamily: "inherit",
      color: "var(--ink-soft)"
    }
  }, "Cancel"), /*#__PURE__*/React.createElement("button", {
    onClick: () => canSave && onSave(d),
    disabled: !canSave,
    className: "ring-focus",
    style: {
      border: "none",
      background: canSave ? "var(--sage)" : "var(--line-strong)",
      color: "#fff",
      borderRadius: 9,
      padding: "8px 16px",
      fontSize: 13,
      fontWeight: 600,
      cursor: canSave ? "pointer" : "not-allowed",
      fontFamily: "inherit"
    }
  }, isNew ? "Add task" : "Save")))));
}
function Select({
  value,
  onChange,
  opts
}) {
  return /*#__PURE__*/React.createElement("select", {
    value: value,
    onChange: e => onChange(e.target.value),
    className: "ring-focus",
    style: {
      background: "var(--card)",
      border: "1px solid var(--line-strong)",
      borderRadius: 10,
      padding: "8px 10px",
      fontSize: 12.5,
      cursor: "pointer"
    }
  }, opts.map(([v, l]) => /*#__PURE__*/React.createElement("option", {
    key: v,
    value: v
  }, l)));
}

/* ---------- Timeline / Gantt ---------- */
function Timeline({
  tasks,
  ganttStart,
  ganttEnd,
  milestones,
  state
}) {
  const LW = 240; // sticky label column width
  const total = Math.max(1, Math.round((ganttEnd - ganttStart) / DAY));
  const weeks = [];
  for (let d = new Date(ganttStart); d <= ganttEnd; d = addDays(d, 7)) weeks.push(new Date(d));
  const colorFor = g => ({
    offer: "var(--sage)",
    journey: "var(--blue)",
    funnel: "var(--amber)",
    delivery: "var(--green)"
  })[g];
  const today = startOfDay(new Date());
  const clamp = v => Math.max(0, Math.min(100, v));
  const pos = d => clamp((startOfDay(d) - ganttStart) / DAY / total * 100);
  const sorted = [...tasks].sort((a, b) => a.start - b.start);
  const chartMin = Math.max(640, total * 11); // ~11px per day so bars are legible

  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--card)",
      border: "1px solid var(--line)",
      borderRadius: 14,
      padding: "4px 0"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-x-4 gap-y-1",
    style: {
      padding: "12px 16px 10px",
      fontSize: 11.5
    }
  }, [["offer", "Offer"], ["journey", "Client journey"], ["funnel", "Funnel"], ["delivery", "Delivery"]].map(([k, l]) => /*#__PURE__*/React.createElement("span", {
    key: k,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      color: "var(--ink-soft)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 11,
      height: 11,
      borderRadius: 3,
      background: colorFor(k)
    }
  }), l)), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: "auto",
      color: "var(--ink-soft)"
    }
  }, "scroll sideways to see the whole plan \u2192")), /*#__PURE__*/React.createElement("div", {
    style: {
      overflow: "auto",
      maxHeight: "72vh"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: LW + chartMin,
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex",
    style: {
      position: "sticky",
      top: 0,
      zIndex: 6,
      background: "var(--card)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: LW,
      flexShrink: 0,
      position: "sticky",
      left: 0,
      zIndex: 7,
      background: "var(--card)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      flex: 1,
      height: 24,
      borderBottom: "1px solid var(--line-strong)"
    }
  }, weeks.map((w, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "tabnum",
    style: {
      position: "absolute",
      left: pos(w) + "%",
      fontSize: 10,
      color: "var(--ink-soft)",
      transform: "translateX(-2px)",
      top: 6
    }
  }, fmt(w))))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 24,
      bottom: 0,
      left: LW,
      right: 0,
      pointerEvents: "none"
    }
  }, milestones.map(m => /*#__PURE__*/React.createElement("div", {
    key: m.key,
    style: {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: pos(m.date) + "%",
      width: 0,
      borderLeft: `2px dotted ${m.color}`
    }
  })), today >= ganttStart && today <= ganttEnd && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: pos(today) + "%",
      width: 0,
      borderLeft: "2px solid var(--ink)"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      paddingBottom: 8
    }
  }, sorted.map((t, ri) => {
    const left = pos(t.start);
    let w = clamp(((t.due - t.start) / DAY + 1) / total * 100);
    w = Math.max(0.6, Math.min(w, 100 - left));
    return /*#__PURE__*/React.createElement("div", {
      key: t.id,
      className: "flex",
      style: {
        minHeight: 34,
        alignItems: "stretch",
        borderTop: ri ? "1px solid var(--line)" : "none"
      }
    }, /*#__PURE__*/React.createElement("div", {
      title: t.id + " · " + t.task,
      style: {
        width: LW,
        flexShrink: 0,
        position: "sticky",
        left: 0,
        zIndex: 2,
        background: "var(--card)",
        paddingLeft: 16,
        paddingRight: 10,
        paddingTop: 7,
        paddingBottom: 7,
        fontSize: 11.5,
        lineHeight: 1.25,
        borderRight: "1px solid var(--line)",
        overflow: "hidden",
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical"
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "tabnum",
      style: {
        color: "var(--ink-soft)",
        fontWeight: 600
      }
    }, t.id), " ", t.task), /*#__PURE__*/React.createElement("div", {
      style: {
        position: "relative",
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      title: `${fmt(t.start)} – ${fmt(t.due)} (${t.duration}d) · ${t.status}`,
      style: {
        position: "absolute",
        top: "50%",
        transform: "translateY(-50%)",
        height: 13,
        borderRadius: 7,
        left: left + "%",
        width: w + "%",
        background: colorFor(t.gate),
        opacity: t.status === "Done" ? .4 : .92,
        border: t.status === "Done" ? "1px solid var(--green)" : t.status === "Blocked" ? "1px solid var(--red)" : "none"
      }
    })));
  })))), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-x-4 gap-y-1",
    style: {
      padding: "10px 16px 14px",
      fontSize: 11,
      color: "var(--ink-soft)",
      borderTop: "1px solid var(--line)"
    }
  }, milestones.map(m => /*#__PURE__*/React.createElement("span", {
    key: m.key,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 0,
      borderLeft: `2px dotted ${m.color}`,
      height: 11
    }
  }), m.label, " ", fmt(m.date))), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 0,
      borderLeft: "2px solid var(--ink)",
      height: 11
    }
  }), "Today")));
}

/* ---------- generic record editor (decisions / risks) ---------- */
function RecordEditor({
  title,
  fields,
  record,
  isNew,
  team,
  onSave,
  onDelete,
  onClose
}) {
  const [d, setD] = useState(record);
  const set = (k, v) => setD(p => ({
    ...p,
    [k]: v
  }));
  const lab = {
    fontSize: 11,
    letterSpacing: ".04em",
    textTransform: "uppercase",
    color: "var(--ink-soft)",
    fontWeight: 600,
    display: "block",
    marginBottom: 4
  };
  const inp = {
    width: "100%",
    background: "#fff",
    border: "1px solid var(--line-strong)",
    borderRadius: 9,
    padding: "8px 10px",
    fontSize: 13,
    fontFamily: "inherit"
  };
  const reqKey = fields.find(f => f.required)?.key;
  const canSave = !reqKey || (d[reqKey] || "").trim().length > 0;
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(31,45,43,.45)",
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "center",
      padding: "28px 14px",
      zIndex: 50,
      overflowY: "auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      background: "var(--card)",
      borderRadius: 16,
      maxWidth: 560,
      width: "100%",
      border: "1px solid var(--line-strong)",
      boxShadow: "0 24px 60px rgba(0,0,0,.25)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between",
    style: {
      padding: "15px 18px",
      borderBottom: "1px solid var(--line)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-display",
    style: {
      fontSize: 18,
      fontWeight: 600
    }
  }, isNew ? "New " + title : "Edit " + title + " " + d.id), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    className: "ring-focus",
    style: {
      border: "none",
      background: "transparent",
      fontSize: 20,
      cursor: "pointer",
      color: "var(--ink-soft)",
      lineHeight: 1
    }
  }, "\xD7")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "16px 18px",
      display: "grid",
      gap: 13
    }
  }, fields.map(f => /*#__PURE__*/React.createElement("div", {
    key: f.key,
    style: f.half ? {} : {
      gridColumn: "1 / -1"
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: lab
  }, f.label), f.type === "textarea" ? /*#__PURE__*/React.createElement("textarea", {
    value: d[f.key] || "",
    onChange: e => set(f.key, e.target.value),
    rows: 2,
    className: "ring-focus",
    style: {
      ...inp,
      resize: "vertical"
    }
  }) : f.type === "owners" ? /*#__PURE__*/React.createElement(OwnerPicker, {
    value: d[f.key],
    team: team || [],
    onChange: v => set(f.key, v)
  }) : f.type === "select" ? /*#__PURE__*/React.createElement("select", {
    value: d[f.key],
    onChange: e => set(f.key, e.target.value),
    className: "ring-focus",
    style: inp
  }, f.options.map(o => Array.isArray(o) ? /*#__PURE__*/React.createElement("option", {
    key: o[0],
    value: o[0]
  }, o[1]) : /*#__PURE__*/React.createElement("option", {
    key: o
  }, o))) : /*#__PURE__*/React.createElement("input", {
    value: d[f.key] || "",
    onChange: e => set(f.key, e.target.value),
    className: "ring-focus",
    style: inp
  })))), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between",
    style: {
      padding: "13px 18px",
      borderTop: "1px solid var(--line)"
    }
  }, !isNew ? /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      if (confirm("Delete " + d.id + "?")) onDelete(d.id);
    },
    className: "ring-focus",
    style: {
      border: "1px solid var(--red)",
      background: "transparent",
      color: "var(--red)",
      borderRadius: 9,
      padding: "8px 13px",
      fontSize: 13,
      cursor: "pointer",
      fontFamily: "inherit"
    }
  }, "Delete") : /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    className: "ring-focus",
    style: {
      border: "1px solid var(--line-strong)",
      background: "transparent",
      borderRadius: 9,
      padding: "8px 14px",
      fontSize: 13,
      cursor: "pointer",
      fontFamily: "inherit",
      color: "var(--ink-soft)"
    }
  }, "Cancel"), /*#__PURE__*/React.createElement("button", {
    onClick: () => canSave && onSave(d),
    disabled: !canSave,
    className: "ring-focus",
    style: {
      border: "none",
      background: canSave ? "var(--sage)" : "var(--line-strong)",
      color: "#fff",
      borderRadius: 9,
      padding: "8px 16px",
      fontSize: 13,
      fontWeight: 600,
      cursor: canSave ? "pointer" : "not-allowed",
      fontFamily: "inherit"
    }
  }, isNew ? "Add" : "Save")))));
}
function nextId(list, prefix) {
  const n = list.reduce((m, x) => {
    const v = parseInt(String(x.id).replace(/\D/g, ""), 10);
    return isNaN(v) ? m : Math.max(m, v);
  }, 0);
  return prefix + String(n + 1).padStart(3, "0");
}
function AddButton({
  onClick,
  label
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    className: "ring-focus",
    style: {
      background: "var(--sage)",
      color: "#fff",
      border: "none",
      borderRadius: 10,
      padding: "8px 14px",
      fontSize: 13,
      fontWeight: 600,
      cursor: "pointer",
      fontFamily: "inherit"
    }
  }, label);
}
function EditBtn({
  onClick
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    title: "Edit",
    className: "ring-focus",
    style: {
      border: "1px solid var(--line-strong)",
      background: "transparent",
      borderRadius: 8,
      width: 30,
      height: 28,
      cursor: "pointer",
      fontSize: 13,
      color: "var(--ink-soft)",
      flexShrink: 0
    }
  }, "\u270E");
}
const WINDOW_OPTS = ["Immediate", "Short term", "Pre-launch", "Launch", "Post-launch"];
const RAGLVL = ["High", "Medium", "Low"];
const DEC_FIELDS = [{
  key: "decision",
  label: "Decision",
  type: "textarea",
  required: true
}, {
  key: "owner",
  label: "Owner(s)",
  type: "owners"
}, {
  key: "gate",
  label: "Gate",
  type: "select",
  options: GATES.map(g => [g.key, g.name]),
  half: true
}, {
  key: "conflict",
  label: "Conflict / options",
  type: "text"
}, {
  key: "impact",
  label: "Impact if unresolved",
  type: "text"
}, {
  key: "window",
  label: "Window",
  type: "select",
  options: WINDOW_OPTS,
  half: true
}, {
  key: "status",
  label: "Status",
  type: "select",
  options: ["Open", "In progress", "Done", "Deferred"],
  half: true
}];
const RISK_FIELDS = [{
  key: "risk",
  label: "Risk / issue",
  type: "textarea",
  required: true
}, {
  key: "category",
  label: "Category",
  type: "text",
  half: true
}, {
  key: "owner",
  label: "Owner(s)",
  type: "owners"
}, {
  key: "likelihood",
  label: "Likelihood",
  type: "select",
  options: RAGLVL,
  half: true
}, {
  key: "severity",
  label: "Severity",
  type: "select",
  options: RAGLVL,
  half: true
}, {
  key: "status",
  label: "Status",
  type: "select",
  options: ["Open", "In progress", "Done", "Deferred"],
  half: true
}, {
  key: "mitigation",
  label: "Mitigation",
  type: "textarea"
}, {
  key: "trigger",
  label: "Early warning",
  type: "text"
}, {
  key: "escalation",
  label: "Escalation path",
  type: "text"
}];

/* ---------- Decisions ---------- */
function DecisionsView({
  state,
  setState
}) {
  const [ed, setEd] = useState(null);
  const [isNew, setNew] = useState(false);
  const set = (id, patch) => setState(s => ({
    ...s,
    decisions: s.decisions.map(d => d.id === id ? {
      ...d,
      ...patch
    } : d)
  }));
  const save = o => {
    setState(s => s.decisions.some(d => d.id === o.id) ? {
      ...s,
      decisions: s.decisions.map(d => d.id === o.id ? o : d)
    } : {
      ...s,
      decisions: [...s.decisions, o]
    });
    setEd(null);
  };
  const del = id => {
    setState(s => ({
      ...s,
      decisions: s.decisions.filter(d => d.id !== id)
    }));
    setEd(null);
  };
  const openNew = () => {
    setNew(true);
    setEd({
      id: nextId(state.decisions, "D"),
      decision: "",
      owner: "",
      conflict: "",
      impact: "",
      gate: GATES[0].key,
      window: "Immediate",
      status: "Open"
    });
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "space-y-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "var(--ink-soft)"
    }
  }, state.decisions.length, " decisions \xB7 open ones drive the red gates"), /*#__PURE__*/React.createElement(AddButton, {
    onClick: openNew,
    label: "+ Add decision"
  })), state.decisions.map(d => /*#__PURE__*/React.createElement("div", {
    key: d.id,
    style: {
      background: "var(--card)",
      border: "1px solid var(--line)",
      borderRadius: 13,
      padding: "13px 16px",
      borderLeft: `4px solid ${d.status === "Done" ? "var(--green)" : d.window === "Immediate" ? "var(--red)" : "var(--amber)"}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-start justify-between gap-3"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14.5,
      fontWeight: 600
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "tabnum",
    style: {
      color: "var(--ink-soft)",
      fontWeight: 600,
      marginRight: 6
    }
  }, d.id), d.decision), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: "var(--ink-soft)",
      marginTop: 3
    }
  }, "Conflict / options \xB7 ", d.conflict), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: "var(--red)",
      marginTop: 2
    }
  }, "If unresolved \xB7 ", d.impact)), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col items-end gap-2",
    style: {
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(StatusSelect, {
    value: d.status,
    onChange: v => set(d.id, {
      status: v
    }),
    options: ["Open", "In progress", "Done", "Deferred"]
  }), /*#__PURE__*/React.createElement(EditBtn, {
    onClick: () => {
      setNew(false);
      setEd(d);
    }
  })), /*#__PURE__*/React.createElement(Pill, {
    bg: d.window === "Immediate" ? "var(--red-tint)" : "var(--amber-tint)",
    fg: d.window === "Immediate" ? "var(--red)" : "var(--amber)"
  }, d.window))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: "var(--ink-soft)",
      marginTop: 8,
      borderTop: "1px dashed var(--line)",
      paddingTop: 7
    }
  }, "Owner \xB7 ", d.owner, " \xA0\xB7\xA0 Gate \xB7 ", GATES.find(g => g.key === d.gate)?.name || "—"))), ed && /*#__PURE__*/React.createElement(RecordEditor, {
    title: "decision",
    fields: DEC_FIELDS,
    record: ed,
    isNew: isNew,
    team: state.team,
    onSave: save,
    onDelete: del,
    onClose: () => setEd(null)
  }));
}

/* ---------- Risks ---------- */
function RisksView({
  state,
  setState
}) {
  const [ed, setEd] = useState(null);
  const [isNew, setNew] = useState(false);
  const set = (id, patch) => setState(s => ({
    ...s,
    risks: s.risks.map(r => r.id === id ? {
      ...r,
      ...patch
    } : r)
  }));
  const save = o => {
    setState(s => s.risks.some(r => r.id === o.id) ? {
      ...s,
      risks: s.risks.map(r => r.id === o.id ? o : r)
    } : {
      ...s,
      risks: [...s.risks, o]
    });
    setEd(null);
  };
  const del = id => {
    setState(s => ({
      ...s,
      risks: s.risks.filter(r => r.id !== id)
    }));
    setEd(null);
  };
  const openNew = () => {
    setNew(true);
    setEd({
      id: nextId(state.risks, "R"),
      risk: "",
      category: "",
      likelihood: "Medium",
      severity: "High",
      status: "Open",
      owner: "",
      mitigation: "",
      trigger: "",
      escalation: ""
    });
  };
  const sorted = [...state.risks].sort((a, b) => (b.severity === "High") - (a.severity === "High"));
  return /*#__PURE__*/React.createElement("div", {
    className: "space-y-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "var(--ink-soft)"
    }
  }, state.risks.length, " risks \xB7 ", state.risks.filter(r => r.severity === "High" && r.status !== "Done").length, " open high-severity"), /*#__PURE__*/React.createElement(AddButton, {
    onClick: openNew,
    label: "+ Add risk"
  })), sorted.map(r => /*#__PURE__*/React.createElement("div", {
    key: r.id,
    style: {
      background: "var(--card)",
      border: "1px solid var(--line)",
      borderRadius: 13,
      padding: "13px 16px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-start justify-between gap-3"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14.5,
      fontWeight: 600
    }
  }, sevDot(r.severity), /*#__PURE__*/React.createElement("span", {
    className: "tabnum",
    style: {
      color: "var(--ink-soft)",
      marginRight: 6
    }
  }, r.id), r.risk), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: "var(--ink-soft)",
      marginTop: 3
    }
  }, "Mitigation \xB7 ", r.mitigation), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "var(--ink-soft)",
      marginTop: 2
    }
  }, "Early warning \xB7 ", r.trigger)), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col items-end gap-2",
    style: {
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(StatusSelect, {
    value: r.status,
    onChange: v => set(r.id, {
      status: v
    }),
    options: ["Open", "In progress", "Done", "Deferred"]
  }), /*#__PURE__*/React.createElement(EditBtn, {
    onClick: () => {
      setNew(false);
      setEd(r);
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-1"
  }, /*#__PURE__*/React.createElement(Pill, {
    bg: "var(--gray-tint)",
    fg: "var(--ink-soft)"
  }, "L:", r.likelihood), /*#__PURE__*/React.createElement(Pill, {
    bg: r.severity === "High" ? "var(--red-tint)" : "var(--amber-tint)",
    fg: r.severity === "High" ? "var(--red)" : "var(--amber)"
  }, "S:", r.severity)))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: "var(--ink-soft)",
      marginTop: 8,
      borderTop: "1px dashed var(--line)",
      paddingTop: 7
    }
  }, r.category, " \xA0\xB7\xA0 Owner \xB7 ", r.owner, " \xA0\xB7\xA0 Escalation \xB7 ", r.escalation))), ed && /*#__PURE__*/React.createElement(RecordEditor, {
    title: "risk",
    fields: RISK_FIELDS,
    record: ed,
    isNew: isNew,
    team: state.team,
    onSave: save,
    onDelete: del,
    onClose: () => setEd(null)
  }));
}

/* ---------- Checklists ---------- */
function Checklist({
  title,
  subtitle,
  items,
  prefix,
  state,
  setState,
  gate
}) {
  const set = id => setState(s => ({
    ...s,
    checks: {
      ...s.checks,
      [id]: !s.checks[id]
    }
  }));
  const done = items.filter(i => state.checks[i[0]]).length;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--card)",
      border: "1px solid var(--line)",
      borderRadius: 14,
      overflow: "hidden",
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between",
    style: {
      padding: "13px 16px",
      borderBottom: "1px solid var(--line)",
      background: gate ? "var(--sage-tint)" : "transparent"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "font-display",
    style: {
      fontSize: 15,
      fontWeight: 600
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "var(--ink-soft)"
    }
  }, subtitle)), /*#__PURE__*/React.createElement(Pill, {
    bg: "var(--card)",
    fg: "var(--sage-deep)"
  }, done, "/", items.length)), items.map((it, i) => {
    const checked = !!state.checks[it[0]];
    return /*#__PURE__*/React.createElement("label", {
      key: it[0],
      className: "flex items-center gap-3",
      style: {
        padding: "9px 16px",
        borderTop: i ? "1px solid var(--line)" : "none",
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement("input", {
      type: "checkbox",
      checked: checked,
      onChange: () => set(it[0]),
      style: {
        width: 17,
        height: 17,
        accentColor: "var(--sage)",
        flexShrink: 0
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        textDecoration: checked ? "line-through" : "none",
        color: checked ? "var(--ink-soft)" : "var(--ink)"
      }
    }, it[2]), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: "var(--ink-soft)",
        marginTop: 1
      }
    }, it[1], " \xB7 ", it[3])), /*#__PURE__*/React.createElement(Pill, {
      bg: it[4] === "Critical" || it[4] === "High" ? "var(--red-tint)" : "var(--gray-tint)",
      fg: it[4] === "Critical" || it[4] === "High" ? "var(--red)" : "var(--ink-soft)"
    }, it[4]));
  }));
}
function ChecklistsView({
  state,
  setState
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--red-tint)",
      border: "1px solid #e6c3b8",
      borderRadius: 12,
      padding: "12px 15px",
      marginBottom: 18,
      fontSize: 13,
      color: "var(--red)"
    }
  }, /*#__PURE__*/React.createElement("b", null, "Launch gate, not admin."), " Do not scale marketing until the GDPR & triage checklist is substantially complete. This service handles sensitive divorce situations."), /*#__PURE__*/React.createElement(Checklist, {
    title: "GDPR, consent & triage",
    subtitle: "Sensitive-data and client-safety controls",
    items: GDPR_CHECKS,
    state: state,
    setState: setState,
    gate: true
  }), /*#__PURE__*/React.createElement(Checklist, {
    title: "Technology, payments & automation",
    subtitle: "End-to-end funnel readiness",
    items: TECH_CHECKS,
    state: state,
    setState: setState
  }));
}

/* ---------- Team / owners directory ---------- */
const TEAM_FIELDS = [{
  key: "name",
  label: "Name / team",
  type: "text",
  required: true
}, {
  key: "role",
  label: "Role",
  type: "text"
}];
function TeamView({
  state,
  setState
}) {
  const [ed, setEd] = useState(null);
  const [isNew, setNew] = useState(false);
  const save = o => {
    setState(s => s.team.some(t => t.id === o.id) ? {
      ...s,
      team: s.team.map(t => t.id === o.id ? o : t)
    } : {
      ...s,
      team: [...s.team, o]
    });
    setEd(null);
  };
  const del = id => {
    setState(s => ({
      ...s,
      team: s.team.filter(t => t.id !== id)
    }));
    setEd(null);
  };
  const openNew = () => {
    setNew(true);
    setEd({
      id: nextId(state.team, "P"),
      name: "",
      role: ""
    });
  };
  const owns = name => {
    const t = state.tasks.filter(x => (x.owner || "").split(" / ").map(s => s.trim()).includes(name)).length;
    const d = state.decisions.filter(x => (x.owner || "").split(" / ").map(s => s.trim()).includes(name)).length;
    const r = state.risks.filter(x => (x.owner || "").split(" / ").map(s => s.trim()).includes(name)).length;
    return {
      t,
      d,
      r
    };
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "space-y-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "var(--ink-soft)"
    }
  }, "People & teams \xB7 used to assign owners on tasks, decisions and risks"), /*#__PURE__*/React.createElement(AddButton, {
    onClick: openNew,
    label: "+ Add person"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--card)",
      border: "1px solid var(--line)",
      borderRadius: 14,
      maxHeight: "70vh",
      overflow: "auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      position: "sticky",
      top: 0,
      zIndex: 5,
      background: "var(--card)",
      gridTemplateColumns: "1fr 1.4fr 150px 34px",
      gap: 8,
      padding: "9px 16px",
      borderBottom: "1px solid var(--line-strong)",
      fontSize: 10.5,
      letterSpacing: ".05em",
      textTransform: "uppercase",
      color: "var(--ink-soft)",
      fontWeight: 600
    }
  }, /*#__PURE__*/React.createElement("span", null, "Name / team"), /*#__PURE__*/React.createElement("span", null, "Role"), /*#__PURE__*/React.createElement("span", null, "Assigned to"), /*#__PURE__*/React.createElement("span", null)), state.team.map((m, i) => {
    const c = owns(m.name);
    return /*#__PURE__*/React.createElement("div", {
      key: m.id,
      className: "grid items-center",
      style: {
        gridTemplateColumns: "1fr 1.4fr 150px 34px",
        gap: 8,
        padding: "10px 16px",
        borderTop: i ? "1px solid var(--line)" : "none"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13.5,
        fontWeight: 600
      }
    }, m.name), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12.5,
        color: "var(--ink-soft)"
      }
    }, m.role), /*#__PURE__*/React.createElement("div", {
      className: "tabnum",
      style: {
        fontSize: 11.5,
        color: "var(--ink-soft)"
      }
    }, c.t, " tasks \xB7 ", c.d, " dec \xB7 ", c.r, " risk"), /*#__PURE__*/React.createElement(EditBtn, {
      onClick: () => {
        setNew(false);
        setEd(m);
      }
    }));
  }), state.team.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 14,
      fontSize: 12.5,
      color: "var(--ink-soft)"
    }
  }, "No people yet \u2014 add the first one.")), ed && /*#__PURE__*/React.createElement(RecordEditor, {
    title: "person",
    fields: TEAM_FIELDS,
    record: ed,
    isNew: isNew,
    onSave: save,
    onDelete: del,
    onClose: () => setEd(null)
  }));
}

/* ---------- Reference (journey, RACI-ish, runbook) ---------- */
function ReferenceView({
  state,
  setState
}) {
  const setRun = i => setState(s => ({
    ...s,
    runbook: {
      ...s.runbook,
      [i]: !s.runbook[i]
    }
  }));
  return /*#__PURE__*/React.createElement("div", {
    className: "space-y-7"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SectionTitle, null, "Client journey map"), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--card)",
      border: "1px solid var(--line)",
      borderRadius: 14,
      overflow: "hidden"
    }
  }, JOURNEY.map((j, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "grid",
    style: {
      gridTemplateColumns: "150px 1fr",
      gap: 10,
      padding: "11px 16px",
      borderTop: i ? "1px solid var(--line)" : "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: "var(--sage-deep)"
    }
  }, j[0]), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5
    }
  }, /*#__PURE__*/React.createElement("b", null, "Client:"), " ", j[1]), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: "var(--ink-soft)"
    }
  }, /*#__PURE__*/React.createElement("b", null, "System:"), " ", j[2]), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: "var(--ink-soft)",
      marginTop: 2
    }
  }, j[3], " \xA0\xB7\xA0 control: ", j[4])))))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SectionTitle, null, "Launch-week runbook"), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--card)",
      border: "1px solid var(--line)",
      borderRadius: 14,
      overflow: "hidden"
    }
  }, RUNBOOK.map((d, i) => /*#__PURE__*/React.createElement("label", {
    key: i,
    className: "flex items-start gap-3",
    style: {
      padding: "11px 16px",
      borderTop: i ? "1px solid var(--line)" : "none",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: !!state.runbook[i],
    onChange: () => setRun(i),
    style: {
      width: 17,
      height: 17,
      accentColor: "var(--sage)",
      marginTop: 2,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      fontWeight: 600
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--sage-deep)"
    }
  }, d[0]), " \xB7 ", d[1]), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: "var(--ink-soft)"
    }
  }, d[2]), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: "var(--red)",
      marginTop: 1
    }
  }, "Escalate if \xB7 ", d[4])), /*#__PURE__*/React.createElement(Pill, {
    bg: "var(--gray-tint)",
    fg: "var(--ink-soft)"
  }, d[3]))))));
}

/* ---------- App shell ---------- */
const NAV = [["dashboard", "Dashboard"], ["tasks", "Tasks"], ["timeline", "Timeline"], ["decisions", "Decisions"], ["risks", "Risks"], ["checklists", "Checklists"], ["reference", "Journey & Runbook"], ["team", "Team"]];
const MILESTONES_DEF = [{
  key: "campaign",
  label: "Campaign start",
  offset: -42,
  color: "var(--amber)"
}, {
  key: "webinar",
  label: "Webinar",
  offset: -12,
  color: "var(--blue)"
}, {
  key: "cartopen",
  label: "Cart open",
  offset: -11,
  color: "var(--sage)"
}, {
  key: "cartclose",
  label: "Cart close",
  offset: -1,
  color: "var(--red)"
}, {
  key: "start",
  label: "Programme start",
  offset: 0,
  color: "var(--sage-deep)"
}, {
  key: "nps",
  label: "NPS",
  offset: 14,
  color: "var(--green)"
}];
function defaultState() {
  return {
    __v: 4,
    launch: "2026-09-01",
    gateOverride: Object.fromEntries(GATES.map(g => [g.key, "auto"])),
    milestones: MILESTONES_DEF.map(m => ({
      ...m
    })),
    team: TEAM_DEF.map(teamFromRaw),
    tasks: RAW_TASKS.map(taskFromRaw),
    // full editable task objects
    decisions: RAW_DECISIONS.map(decisionFromRaw),
    risks: RAW_RISKS.map(riskFromRaw),
    checks: {},
    runbook: {}
  };
}

// Bring older saved data forward without losing the user's edits.
function migrate(s) {
  const base = defaultState();
  if (!s) return base;
  // tasks: old format was an object { id:{status} }
  let tasks = base.tasks;
  if (s.tasks && !Array.isArray(s.tasks)) {
    tasks = base.tasks.map(t => s.tasks[t.id] ? {
      ...t,
      status: s.tasks[t.id].status || t.status
    } : t);
  } else if (Array.isArray(s.tasks)) {
    tasks = s.tasks;
  }
  // milestones: keep edited offsets, but always use canonical labels/colours
  const savedMs = Array.isArray(s.milestones) ? Object.fromEntries(s.milestones.map(m => [m.key, m.offset])) : {};
  const milestones = MILESTONES_DEF.map(m => ({
    ...m,
    offset: savedMs[m.key] !== undefined ? savedMs[m.key] : m.offset
  }));
  // gate override: carry forward; if an old manual "gates" map existed, treat it as an override
  const gateOverride = {
    ...base.gateOverride,
    ...(s.gateOverride || {}),
    ...(s.gateOverride ? {} : s.gates || {})
  };
  return {
    ...base,
    __v: 4,
    tasks,
    milestones,
    gateOverride,
    team: Array.isArray(s.team) && s.team.length ? s.team : base.team,
    launch: s.launch || base.launch,
    decisions: s.decisions || base.decisions,
    risks: s.risks || base.risks,
    checks: s.checks || base.checks,
    runbook: s.runbook || base.runbook
  };
}
function App() {
  const [tab, setTab] = useState("dashboard");
  const [state, setState] = useState(() => migrate(store.read()));
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    store.write(state);
    setSaved(true);
    const t = setTimeout(() => setSaved(false), 1200);
    return () => clearTimeout(t);
  }, [state]);
  const launchDate = useMemo(() => startOfDay(new Date(state.launch + "T00:00:00")), [state.launch]);

  // computed task list with live dates from each task's own offset + duration
  const tasks = useMemo(() => state.tasks.map(t => {
    const start = addDays(launchDate, Number(t.offset) || 0);
    const due = addDays(start, Math.max(1, Number(t.duration) || 1) - 1);
    return {
      ...t,
      start,
      due
    };
  }), [launchDate, state.tasks]);

  // milestones come from editable offsets in state
  const milestones = useMemo(() => state.milestones.map(m => ({
    ...m,
    date: addDays(launchDate, Number(m.offset) || 0)
  })), [state.milestones, launchDate]);

  // gantt window stretches to cover every task and milestone, never clipping bars
  const {
    ganttStart,
    ganttEnd
  } = useMemo(() => {
    let lo = addDays(launchDate, -56),
      hi = addDays(launchDate, 28);
    tasks.forEach(t => {
      if (t.start < lo) lo = t.start;
      if (t.due > hi) hi = t.due;
    });
    milestones.forEach(m => {
      if (m.date < lo) lo = m.date;
      if (m.date > hi) hi = m.date;
    });
    return {
      ganttStart: startOfDay(addDays(lo, -3)),
      ganttEnd: startOfDay(addDays(hi, 3))
    };
  }, [tasks, milestones, launchDate]);
  const exportCSV = () => {
    const head = ["ID", "Task", "Workstream", "Gate", "Owner", "Priority", "Risk", "Status", "Start", "Due"];
    const rows = tasks.map(t => [t.id, t.task, t.workstream, GATES.find(g => g.key === t.gate).name, t.owner, t.priority, t.risk, t.status, fmtFull(t.start), fmtFull(t.due)]);
    const csv = [head, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], {
      type: "text/csv"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fenntarthato_valas_tasks.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  const reset = () => {
    if (confirm("Reset all data to the original workbook values? Your changes will be lost.")) {
      store.clear();
      setState(defaultState());
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1180,
      margin: "0 auto",
      padding: "22px 18px 60px"
    }
  }, /*#__PURE__*/React.createElement("header", {
    className: "flex flex-wrap items-end justify-between gap-4",
    style: {
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      letterSpacing: ".18em",
      textTransform: "uppercase",
      color: "var(--sage)",
      fontWeight: 600
    }
  }, "Launch Control \xB7 v0.4"), /*#__PURE__*/React.createElement("h1", {
    className: "font-display",
    style: {
      fontSize: 30,
      fontWeight: 600,
      margin: "2px 0 0",
      lineHeight: 1.05
    }
  }, "Fenntarthat\xF3 V\xE1l\xE1s"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "var(--ink-soft)",
      marginTop: 3
    }
  }, "Control tower for launch readiness \u2014 gates, tasks, timing, decisions & risks.")), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--card)",
      border: "1px solid var(--line-strong)",
      borderRadius: 12,
      padding: "8px 12px"
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 10,
      letterSpacing: ".05em",
      textTransform: "uppercase",
      color: "var(--ink-soft)",
      display: "block"
    }
  }, "Launch / programme start"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: state.launch,
    onChange: e => setState(s => ({
      ...s,
      launch: e.target.value
    })),
    className: "ring-focus tabnum",
    style: {
      border: "none",
      background: "transparent",
      fontSize: 15,
      fontWeight: 600,
      color: "var(--sage-deep)",
      cursor: "pointer"
    }
  })))), /*#__PURE__*/React.createElement("nav", {
    className: "flex flex-wrap gap-1",
    style: {
      background: "var(--card)",
      border: "1px solid var(--line)",
      borderRadius: 12,
      padding: 5,
      marginBottom: 22
    }
  }, NAV.map(([k, l]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    onClick: () => setTab(k),
    style: {
      border: "none",
      cursor: "pointer",
      borderRadius: 8,
      padding: "8px 13px",
      fontSize: 13,
      fontWeight: 600,
      fontFamily: "inherit",
      background: tab === k ? "var(--sage)" : "transparent",
      color: tab === k ? "#fff" : "var(--ink-soft)",
      transition: "all .15s"
    }
  }, l)), /*#__PURE__*/React.createElement("div", {
    className: "ml-auto flex gap-1 items-center",
    style: {
      paddingRight: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: saved ? "var(--green)" : "var(--ink-soft)",
      transition: "color .2s"
    }
  }, saved ? "✓ saved" : "\u00a0"), /*#__PURE__*/React.createElement("button", {
    onClick: exportCSV,
    title: "Export tasks to CSV",
    style: {
      border: "1px solid var(--line-strong)",
      background: "transparent",
      borderRadius: 8,
      padding: "7px 11px",
      fontSize: 12,
      cursor: "pointer",
      fontFamily: "inherit",
      color: "var(--ink-soft)"
    }
  }, "Export CSV"), /*#__PURE__*/React.createElement("button", {
    onClick: reset,
    title: "Reset to original data",
    style: {
      border: "1px solid var(--line-strong)",
      background: "transparent",
      borderRadius: 8,
      padding: "7px 11px",
      fontSize: 12,
      cursor: "pointer",
      fontFamily: "inherit",
      color: "var(--ink-soft)"
    }
  }, "Reset"))), tab === "dashboard" && /*#__PURE__*/React.createElement(Dashboard, {
    state: state,
    setState: setState,
    milestones: milestones,
    tasks: tasks
  }), tab === "tasks" && /*#__PURE__*/React.createElement(TasksView, {
    state: state,
    setState: setState,
    tasks: tasks,
    launchDate: launchDate
  }), tab === "timeline" && /*#__PURE__*/React.createElement(Timeline, {
    tasks: tasks,
    ganttStart: ganttStart,
    ganttEnd: ganttEnd,
    milestones: milestones,
    state: state
  }), tab === "decisions" && /*#__PURE__*/React.createElement(DecisionsView, {
    state: state,
    setState: setState
  }), tab === "risks" && /*#__PURE__*/React.createElement(RisksView, {
    state: state,
    setState: setState
  }), tab === "checklists" && /*#__PURE__*/React.createElement(ChecklistsView, {
    state: state,
    setState: setState
  }), tab === "reference" && /*#__PURE__*/React.createElement(ReferenceView, {
    state: state,
    setState: setState
  }), tab === "team" && /*#__PURE__*/React.createElement(TeamView, {
    state: state,
    setState: setState
  }), /*#__PURE__*/React.createElement("footer", {
    style: {
      marginTop: 34,
      paddingTop: 14,
      borderTop: "1px solid var(--line)",
      fontSize: 11,
      color: "var(--ink-soft)",
      textAlign: "center"
    }
  }, "Single source of operational truth. Change one launch date; all task dates and the timeline recalculate. Edits save automatically in this browser."));
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(App, null));
