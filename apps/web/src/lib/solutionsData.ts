export interface SolutionVertical {
  slug: string;
  name: string;
  shortDesc: string;
  heroTitle: string;
  heroSubtitle: string;
  badge: string;
  overview: string;
  painPoints: Array<{
    problem: string;
    consequence: string;
    solution: string;
  }>;
  solutionStack: Array<{
    title: string;
    description: string;
  }>;
  recommendedBundle: {
    packageName: string;
    packagePriceKenya: string;
    packagePriceIntl: string;
    carePlan: string;
    carePriceKenya: string;
    carePriceIntl: string;
    summary: string;
  };
  recommendedAddons: string[];
  proofMetric: {
    stat: string;
    label: string;
  };
  faqs: Array<{
    question: string;
    answer: string;
  }>;
}

export const SOLUTIONS_DATA: Record<string, SolutionVertical> = {
  smes: {
    slug: 'smes',
    name: 'Small & Medium Businesses',
    shortDesc: 'Digital systems and high-converting websites engineered for growing companies.',
    heroTitle: 'Engineered Digital Systems for Growing SMEs',
    heroSubtitle:
      'Transform your business from relying on manual WhatsApp chats and slow social media pages into an automated, lead-generating digital asset.',
    badge: 'Growing Commercial Enterprises',
    overview:
      'Most small and medium enterprises in Kenya and emerging markets lose up to 40% of prospective clients due to amateurish websites, slow mobile load times, and missing lead capture workflows. BazionWeb builds fast, conversion-focused websites that establish instant market authority.',
    painPoints: [
      {
        problem: 'Outdated or broken mobile experience',
        consequence: 'Prospects leave within 3 seconds and turn to competitors.',
        solution: 'Mobile-first Next.js architecture with sub-2-second page speeds.',
      },
      {
        problem: 'Manual lead handling during off-hours',
        consequence: 'High-intent inquiries go unanswered overnight.',
        solution: 'Automated multi-step inquiry forms with instant email and WhatsApp routing.',
      },
      {
        problem: 'Trapped in expensive agency retainers',
        consequence: 'Surprise maintenance fees and zero asset ownership.',
        solution: '100% client asset ownership guarantee with transparent fixed pricing.',
      },
    ],
    solutionStack: [
      {
        title: 'High-Converting Business Website',
        description: 'Up to 10 structured pages with custom UI, CMS self-editing, and Google Search Console optimization.',
      },
      {
        title: 'Automated Lead Qualification',
        description: 'Interactive intake forms pre-qualify client needs before routing directly to your sales team.',
      },
      {
        title: 'Local SEO & Google Maps Visibility',
        description: 'Structured Schema.org markup ensuring local prospects find your business on top Google searches.',
      },
      {
        title: 'Proactive Monthly Care Retainer',
        description: 'Continuous backups, security patches, and monthly performance tuning so your team focuses on growth.',
      },
    ],
    recommendedBundle: {
      packageName: 'Business Website Package',
      packagePriceKenya: 'KSh 90,000',   // ← canonical: priceBooks.ts KE-2026-v1
      packagePriceIntl: '$950',          // ← canonical: priceBooks.ts GLOBAL-2026-v1
      carePlan: 'Care Business',
      carePriceKenya: 'KSh 10,000/mo',
      carePriceIntl: '$89/mo',
      summary: 'Custom 10-page website, CMS integration, lead capture pipeline, and 30-day post-launch warranty.',
    },
    recommendedAddons: [
      'Dynamic Blog & News Engine (KSh 7,500 / $120)',
      'Advanced Multi-Step Form (KSh 5,000 / $80)',
      'Local SEO Foundation (KSh 15,000 / $220)',
    ],
    proofMetric: {
      stat: '+140%',
      label: 'Average increase in inbound inquiry volume for SME clients',
    },
    faqs: [
      {
        question: 'Can my non-technical staff update content on our website?',
        answer:
          'Yes. Every Business and Professional website includes an intuitive Content Management System (CMS) and a recorded 1-on-1 staff walkthrough video.',
      },
      {
        question: 'Do we own our domain name and website source code?',
        answer:
          'Absolutely 100%. BazionWeb guarantees complete client ownership of domains, code, databases, and media upon final invoice clearance.',
      },
      {
        question: 'How fast can our SME website go live?',
        answer:
          'Our standard Business Website timeline is 10 to 15 working days from content approval, with an expedited rush option available.',
      },
    ],
  },
  churches: {
    slug: 'churches',
    name: 'Churches & Ministries',
    shortDesc: 'Digital platforms, automated M-Pesa giving, and media libraries for modern ministries.',
    heroTitle: 'Digital Platforms for Ministries & Churches',
    heroSubtitle:
      'Unify member communication, automate M-Pesa tithes & offerings, and broadcast inspiring sermon media across Kenya and the diaspora.',
    badge: 'Faith-Based & Ministry Solutions',
    overview:
      'Modern ministries require dignity, financial transparency, and reliable communication. BazionWeb replaces chaotic WhatsApp groups and manual accounting sheets with unified church platforms and automated giving reconciliation.',
    painPoints: [
      {
        problem: 'Manual tithe & offering reconciliation',
        consequence: 'Bursars spend days manually matching bank and M-Pesa statements.',
        solution: 'Automated M-Pesa STK Push giving with instant member SMS receipts and ledger sync.',
      },
      {
        problem: 'Fragmented member announcements',
        consequence: 'Key ministry events missed by congregants across scattered chat groups.',
        solution: 'Central events calendar and branded bulk SMS notifications via Africa\'s Talking.',
      },
      {
        problem: 'Sermon media buried on social feeds',
        consequence: 'Valuable biblical teachings lost in algorithm noise.',
        solution: 'Dedicated sermon audio/video archive with search, series playlists, and podcast feeds.',
      },
    ],
    solutionStack: [
      {
        title: 'M-Pesa STK & Diaspora Card Giving',
        description: 'Frictionless giving for local members via M-Pesa and diaspora supporters via Visa/Mastercard.',
      },
      {
        title: 'Sermon Audio & Video Library',
        description: 'Categorized by speaker, topic, scripture, and series with instant audio streaming.',
      },
      {
        title: 'Church Management (ChMS) Integration',
        description: 'Member directory, cell group assignments, ministry departments, and prayer request pipelines.',
      },
      {
        title: 'Dignified Ministry Brand Experience',
        description: 'Clean, reverent UI design reflecting the spiritual authority and vision of your church.',
      },
    ],
    recommendedBundle: {
      packageName: 'Professional Church Platform',
      packagePriceKenya: 'KSh 160,000',  // ← canonical: priceBooks.ts KE-2026-v1
      packagePriceIntl: '$1,750',        // ← canonical: priceBooks.ts GLOBAL-2026-v1
      carePlan: 'Care Business',
      carePriceKenya: 'KSh 10,000/mo',
      carePriceIntl: '$89/mo',
      summary: 'Up to 15 pages, sermon archive, events manager, M-Pesa integration, and 60-day warranty.',
    },
    recommendedAddons: [
      'M-Pesa Daraja Automated Giving Gateway (KSh 10,000)',
      'Africa\'s Talking Bulk SMS Alerts (KSh 8,500)',
      'Church Management Member Registry (From KSh 200,000 / $3,900)',
    ],
    proofMetric: {
      stat: '99.9%',
      label: 'Uptime maintained during peak Sunday streaming and giving windows',
    },
    faqs: [
      {
        question: 'Can church members in the USA or UK give offerings easily?',
        answer:
          'Yes. We integrate multi-currency card payment processing (Visa, Mastercard) alongside Kenyan M-Pesa.',
      },
      {
        question: 'Is church financial data kept private and confidential?',
        answer:
          'Completely. Financial records and donor databases are secured with encrypted PostgreSQL storage adhering to the Kenya Data Protection Act 2019.',
      },
    ],
  },
  education: {
    slug: 'education',
    name: 'Schools & Educational Institutions',
    shortDesc: 'Student information portals, admissions engines, and institutional management systems.',
    heroTitle: 'Student Portals & Management Systems for Education',
    heroSubtitle:
      'Streamline admissions, student grade books, fee accounting, and parent communication with enterprise educational platforms.',
    badge: 'Educational Institutions & Academies',
    overview:
      'Paper-based student records, physical fee deposit slips, and manual report cards create administrative friction. BazionWeb builds secure student information systems (SIS) and modern school portals designed for Kenyan curriculums and international academies.',
    painPoints: [
      {
        problem: 'Chaotic admissions and enrollment cycles',
        consequence: 'Long queues and lost student application documents.',
        solution: 'Online digital admission intake with automated document upload and verification.',
      },
      {
        problem: 'Delayed school fee reconciliation',
        consequence: 'Fee defaulters slip through administrative cracks.',
        solution: 'Direct M-Pesa Paybill / Bank integration matching student admission numbers automatically.',
      },
      {
        problem: 'High printing costs for exam report cards',
        consequence: 'Significant paper waste and delayed parent delivery.',
        solution: 'Automated PDF term report card generation downloadable via parent student portal.',
      },
    ],
    solutionStack: [
      {
        title: 'Student & Parent Portal (SIS)',
        description: 'Secure authenticated login for exam results, attendance records, and term announcements.',
      },
      {
        title: 'Automated Fee Ledger & Receipts',
        description: 'Real-time balance tracking with instant SMS payment receipts sent to parents.',
      },
      {
        title: 'Public Institutional Website',
        description: 'Prestigious public face showcasing academic excellence, sports facilities, and fee structures.',
      },
      {
        title: 'Teacher Grade Book & Evaluation',
        description: 'Intuitive interface for instructors to enter exam scores, calculate GPAs, and submit remarks.',
      },
    ],
    recommendedBundle: {
      packageName: 'School Management System & Portal',
      packagePriceKenya: 'Starting from KSh 250,000',
      packagePriceIntl: 'Starting from $7,500',
      carePlan: 'Care Professional',
      carePriceKenya: 'KSh 20,000/mo',
      carePriceIntl: '$300/mo',
      summary: 'Complete institutional SIS, student database, fee reconciliation, and high-concurrency exam hosting.',
    },
    recommendedAddons: [
      'Role-Based Access Control (Admin, Teacher, Parent) (KSh 20,000 / $400)',
      'Automated PDF Report Card Generator (KSh 18,000 / $350)',
      'Parent Attendance SMS Alerts (KSh 10,000 / $200)',
    ],
    proofMetric: {
      stat: '85%',
      label: 'Reduction in bursar manual fee reconciliation time',
    },
    faqs: [
      {
        question: 'Does the system support CBC (Competency-Based Curriculum) reporting?',
        answer:
          'Yes. Our school management system supports customizable grading rubrics, CBC strands, and traditional percentage scales.',
      },
      {
        question: 'Can parents access grades on their smartphones?',
        answer:
          'Yes. The parent portal is 100% mobile-responsive and functions smoothly on low-bandwidth smartphone connections.',
      },
    ],
  },
  ngos: {
    slug: 'ngos',
    name: 'NGOs & Non-Profit Organizations',
    shortDesc: 'High-trust digital platforms, donor impact reporting, and document libraries.',
    heroTitle: 'High-Trust Digital Platforms for Non-Profits & NGOs',
    heroSubtitle:
      'Prove transparent program impact, satisfy international grant audits, and accept global donations with high-compliance digital architectures.',
    badge: 'Non-Profits & Grant-Funded Programs',
    overview:
      'International grant funders require demonstrable transparency, accessibility, and data sovereignty. BazionWeb builds non-profit platforms engineered to showcase field impact and pass rigorous governance audits.',
    painPoints: [
      {
        problem: 'Failing international donor due-diligence checks',
        consequence: 'Loss of major funding grants due to amateur digital presence.',
        solution: 'Enterprise design with compliance disclosures, financial audits, and governance bios.',
      },
      {
        problem: 'Difficulty publishing heavy field reports',
        consequence: 'Research PDFs buried in obscure Google Drive links.',
        solution: 'Structured downloadable document hub with categorization, search, and reading summaries.',
      },
      {
        problem: 'Restricted international donation rails',
        consequence: 'Global supporters encounter credit card checkout declines.',
        solution: 'Multi-currency donation processing supporting USD, EUR, GBP, and KES seamlessly.',
      },
    ],
    solutionStack: [
      {
        title: 'Impact & Project Showcase Hub',
        description: 'Interactive case studies displaying beneficiary statistics, geographic reach, and SDG alignment.',
      },
      {
        title: 'Publications & Audit Library',
        description: 'Secure PDF archive for annual financial audits, research papers, and strategic plans.',
      },
      {
        title: 'Compliant Multi-Currency Giving',
        description: 'Recurring monthly and one-time donor payment channels with automated tax deduction receipts.',
      },
      {
        title: 'Data Privacy & GDPR / Kenya DPA Compliance',
        description: 'Strict consent management, cookie policies, and secure beneficiary data storage.',
      },
    ],
    recommendedBundle: {
      packageName: 'Professional NGO Platform',
      packagePriceKenya: 'KSh 160,000 – KSh 320,000', // ← canonical range: priceBooks.ts
      packagePriceIntl: '$2,850 – $5,500',             // ← canonical range: priceBooks.ts
      carePlan: 'Care Business',
      carePriceKenya: 'KSh 10,000/mo',
      carePriceIntl: '$150/mo',
      summary: 'Impact portal, research publication archive, donor pipeline, and 60-day post-launch support.',
    },
    recommendedAddons: [
      'Downloadable Document Hub (KSh 6,000 / $120)',
      'Multilingual i18n Architecture (KSh 15,000 / $350)',
      'International Card Donation Rails (KSh 10,000 / $200)',
    ],
    proofMetric: {
      stat: '100%',
      label: 'Compliance rate on institutional donor digital security audits',
    },
    faqs: [
      {
        question: 'Can we accept donations in foreign currencies like USD or EUR?',
        answer:
          'Yes. We integrate Stripe and IntaSend international payment gateways that settle funds directly to your organization\'s bank account.',
      },
      {
        question: 'Is the platform compliant with the Kenya Data Protection Act 2019?',
        answer:
          'Yes. All forms, database models, and tracking scripts strictly adhere to national and international privacy standards.',
      },
    ],
  },
  startups: {
    slug: 'startups',
    name: 'Startups & Product MVPs',
    shortDesc: 'Rapid MVP engineering, high-converting product landing pages, and scalable APIs.',
    heroTitle: 'Rapid MVP Engineering for Digital Product Founders',
    heroSubtitle:
      'Launch your Minimum Viable Product in weeks, not months. Modern Next.js 14, NestJS, and PostgreSQL architectures built to scale.',
    badge: 'Tech Founders & Product Innovators',
    overview:
      'Founders are often trapped between overpriced agencies quoting $30,000+ and unreliable freelancers who write unmaintainable code. BazionWeb provides senior software engineering execution with clean TypeScript codebases and fast turnaround.',
    painPoints: [
      {
        problem: 'Slow development burning runway',
        consequence: 'Competitors launch first; investor interest wanes.',
        solution: 'Rapid agile sprints delivering functional MVPs in 4 to 8 weeks.',
      },
      {
        problem: 'Messy legacy code that cannot scale',
        consequence: 'Complete rewrite needed after first 1,000 active users.',
        solution: 'Production-ready Next.js 14, NestJS REST API, and PostgreSQL schema from day one.',
      },
      {
        problem: 'Vendor lock-in and hostage IP',
        consequence: 'Investors identify intellectual property risks during technical due-diligence.',
        solution: 'Full Git repository ownership and unencumbered commercial license transfer.',
      },
    ],
    solutionStack: [
      {
        title: 'Full-Stack MVP Web Application',
        description: 'React/Next.js frontend, authenticated user sessions, database CRUD, and payment webhooks.',
      },
      {
        title: 'High-Converting Product Launch Page',
        description: 'Waitlist capture, interactive product mockups, and performance scores above 95.',
      },
      {
        title: 'Modular API Architecture',
        description: 'Documented Swagger OpenAPI endpoints ready for mobile app connectivity.',
      },
      {
        title: 'Containerized Cloud Deployment',
        description: 'Docker Compose orchestration on Render or AWS with CI/CD GitHub deployment pipelines.',
      },
    ],
    recommendedBundle: {
      packageName: 'SaaS MVP Engineering Sprint',
      packagePriceKenya: 'Starting from KSh 500,000',
      packagePriceIntl: 'Starting from $10,000 – $15,000',
      carePlan: 'Care Professional / Managed Cloud',
      carePriceKenya: 'From KSh 20,000/mo',
      carePriceIntl: 'From $300/mo',
      summary: 'Complete technical architecture, database ERD, full-stack MVP build, and staging CI/CD deployment.',
    },
    recommendedAddons: [
      'SSO Authentication (Google / Microsoft) (KSh 15,000 / $300)',
      'Enterprise Audit Logging (KSh 15,000 / $300)',
      'Dedicated Staging Environment (KSh 10,000 / $150)',
    ],
    proofMetric: {
      stat: '4–6 Wks',
      label: 'Average turnaround from discovery blueprint to live production MVP',
    },
    faqs: [
      {
        question: 'Who owns the intellectual property and code of our startup?',
        answer:
          'You retain 100% of the intellectual property, git repositories, and code from day one.',
      },
      {
        question: 'Can this MVP scale if we raise seed funding?',
        answer:
          'Yes. We use standard industry architectures (Next.js, TypeScript, PostgreSQL, Docker) that any senior engineer can step into and scale.',
      },
    ],
  },
  'professional-services': {
    slug: 'professional-services',
    name: 'Professional Services',
    shortDesc: 'Prestigious digital authority and client intake systems for law firms, medical clinics, and consultants.',
    heroTitle: 'Prestige Digital Presence for Law, Medical & Consulting',
    heroSubtitle:
      'Elevate your firm\'s commercial authority, pre-qualify high-value client briefs, and automate appointment intake.',
    badge: 'Legal, Healthcare & Financial Practices',
    overview:
      'High-net-worth clients and corporate boards judge professional practices by their digital gravitas. BazionWeb builds authoritative, refined digital presences for law firms, specialized medical clinics, accountants, and executive advisors.',
    painPoints: [
      {
        problem: 'Time wasted on unqualified consultations',
        consequence: 'Partners spend hours screening inquiries with insufficient budget or fit.',
        solution: 'Intelligent multi-step intake questionnaires that screen and pre-qualify inquiries.',
      },
      {
        problem: 'Outdated website that undermines professional authority',
        consequence: 'Clients hesitate to pay premium retainer fees.',
        solution: 'Prestigious, typography-led editorial design with verified partner credentials.',
      },
      {
        problem: 'Administrative phone tag for booking appointments',
        consequence: 'Lost clients who book elsewhere before receiving a callback.',
        solution: 'Integrated confidential calendar scheduling with Google Calendar sync.',
      },
    ],
    solutionStack: [
      {
        title: 'Editorial Authority Design',
        description: 'Bespoke layouts showcasing practice areas, partner bios, publications, and landmark cases.',
      },
      {
        title: 'Confidential Client Intake Portal',
        description: 'Secure, encrypted forms for preliminary case assessments or patient registration.',
      },
      {
        title: 'Practice Area Knowledge Hub',
        description: 'Legal briefs, white papers, and articles establishing search authority for high-value keywords.',
      },
      {
        title: 'Discreet Online Retainer Payment',
        description: 'Card and bank deposit links allowing clients to settle consultation retainers smoothly.',
      },
    ],
    recommendedBundle: {
      packageName: 'Professional Practice Platform',
      packagePriceKenya: 'KSh 160,000',  // ← canonical: priceBooks.ts KE-2026-v1
      packagePriceIntl: '$1,750',        // ← canonical: priceBooks.ts GLOBAL-2026-v1
      carePlan: 'Care Essential',
      carePriceKenya: 'KSh 5,000/mo',
      carePriceIntl: '$39/mo',
      summary: 'Up to 15 pages, practice area index, partner profiles, appointment intake, and 60-day support.',
    },
    recommendedAddons: [
      'Advanced Client Intake Screening Form (KSh 5,000 / $80)',
      'Publications & Legal Insights Hub (KSh 7,500 / $120)',
      'Online Consultation Booking Engine (From KSh 15,000 / $220)',
    ],
    proofMetric: {
      stat: '3x',
      label: 'Higher pre-qualified consultation booking rate for partner firms',
    },
    faqs: [
      {
        question: 'Can we restrict access to sensitive client documents?',
        answer:
          'Yes. We can incorporate secure client portals with role-based access control and encrypted document storage.',
      },
      {
        question: 'Does the website comply with professional advertising regulations?',
        answer:
          'Yes. We adhere strictly to ethical guidelines and professional bodies\' advertising standards (e.g. Law Society of Kenya, Medical Council).',
      },
    ],
  },
};
