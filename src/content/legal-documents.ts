import type { Lang } from "@/lib/i18n-locale";

export type LegalDocumentKind = "privacy" | "consent" | "terms";

export type LegalSection = {
  title: string;
  paragraphs?: string[];
  items?: string[];
};

export type LegalDocument = {
  title: string;
  shortTitle: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
};

const contactEmail = "teamflowai.privacy@gmail.com";

const documents: Record<Lang, Record<LegalDocumentKind, LegalDocument>> = {
  en: {
    privacy: {
      title: "Personal Data Processing Policy (Privacy Policy)",
      shortTitle: "Privacy Policy",
      updated: "Last updated: August 12, 2026",
      intro:
        "This Policy explains how personal data is processed when you use the TeamFlow AI website and service. In case of discrepancies, the Russian version prevails.",
      sections: [
        {
          title: "1. General provisions",
          paragraphs: [
            "TeamFlow AI is a service for team collaboration, project and task management, communications, file sharing, and related functions.",
            `The personal data operator is Artem Vadimovich Maksimov, an individual. Questions about personal data and legal matters may be sent to ${contactEmail}.`,
            "This Policy applies to data processed through the TeamFlow AI website and service.",
          ],
        },
        {
          title: "2. Key terms",
          items: [
            "Personal data means information relating directly or indirectly to an identified or identifiable individual.",
            "Processing means any operation or set of operations performed on personal data, including collection, recording, storage, use, transfer, restriction, deletion, and destruction.",
            "Operator means the person who determines the purposes and means of personal data processing.",
            "User means an individual who visits the website, creates an account, or uses TeamFlow AI.",
          ],
        },
        {
          title: "3. Data that may be processed",
          items: [
            "Name, display name, email address, avatar, and other profile information provided by the user.",
            "Account data, workspace membership, roles, invitations, and user or workspace settings.",
            "Projects, tasks, descriptions, statuses, priorities, deadlines, assignments, comments, and related activity.",
            "Channel and direct chat messages, reactions, pinned messages, and communication metadata.",
            "Files and attachments voluntarily uploaded to profiles, projects, tasks, or chats.",
            "Technical data required to operate and protect the service, such as IP address, browser or device information, request timestamps, authentication identifiers, and service logs where generated.",
            "Selected plan, payment identifier and status, and service information needed to process a plan change. Full bank-card numbers and CVV codes are handled by the payment provider and are not requested or stored by TeamFlow AI.",
            "Questions submitted to AI Copilot and the minimum workspace context needed to answer them, limited to information available to the requesting user.",
          ],
        },
        {
          title: "4. Processing purposes",
          items: [
            "Creating, authenticating, and maintaining user accounts.",
            "Providing workspaces, projects, tasks, Kanban, team collaboration, chat, notifications, and file storage.",
            "Providing support, diagnosing failures, preventing abuse, and protecting accounts and the service.",
            "Processing payments, confirming their status, and granting the selected plan after successful server-side confirmation.",
            "Running AI Copilot at the user's request and producing workspace-grounded responses.",
            "Complying with applicable legal obligations and resolving disputes.",
          ],
        },
        {
          title: "5. Legal grounds",
          paragraphs: [
            "Personal data is processed on the basis of the user's consent where consent is required, for performance of the TeamFlow AI Terms of Use, to comply with applicable law, and on other grounds provided by law where they apply to the specific processing.",
          ],
        },
        {
          title: "6. Processing operations",
          paragraphs: [
            "Processing is primarily automated and may include collection, recording, organisation, accumulation, storage, updating, retrieval, use, provision of access or transfer where required for service providers, restriction, deletion, and destruction. Data is not distributed to an indefinite group of persons unless the user intentionally makes it available through a service function or the law requires disclosure.",
          ],
        },
        {
          title: "7. Service providers",
          paragraphs: [
            "TeamFlow AI may use Google OAuth for authentication, YooKassa for payments, Supabase Storage for user files, Groq for AI Copilot, and hosting and database infrastructure for service operation. Each provider receives only the data reasonably needed for its function and processes it under its own terms and applicable requirements.",
            "Some providers or their infrastructure may be located outside the Russian Federation. The actual data locations and any cross-border transfers depend on the deployed configuration and provider arrangements. TeamFlow AI does not claim that all data is stored in Russia unless this has been separately verified for the production deployment.",
          ],
        },
        {
          title: "8. Cookies and local storage",
          paragraphs: [
            "The service uses necessary authentication or session identifiers and browser storage for language, theme, interface preferences, safe redirect state, and temporary billing-return state. These mechanisms support security and core product functions. TeamFlow AI does not currently use advertising or marketing analytics cookies in the client application.",
          ],
        },
        {
          title: "9. Retention and deletion",
          paragraphs: [
            "Data is processed until the relevant purpose is achieved, while the account or relationship with the user exists, or until consent is withdrawn where consent is the applicable ground. Data may be retained longer only where required by law or reasonably necessary to meet obligations or resolve disputes. When no lawful ground remains, data is deleted or destroyed in accordance with applicable requirements and technical procedures.",
          ],
        },
        {
          title: "10. Data protection",
          paragraphs: [
            "The operator applies reasonable organisational and technical measures, including access controls, authentication, separation of user permissions, and measures intended to prevent unauthorised access, alteration, disclosure, or loss. No online service can promise absolute security.",
          ],
        },
        {
          title: "11. User rights",
          items: [
            "Request information about personal data processing.",
            "Request correction, restriction, or deletion where provided by law.",
            "Withdraw consent without affecting processing lawfully carried out before withdrawal.",
            `Contact the operator at ${contactEmail} and exercise other rights provided by applicable law.`,
          ],
        },
        {
          title: "12. Policy changes",
          paragraphs: [
            "The operator may update this Policy. The current version and its revision date are published at /privacy.",
          ],
        },
        {
          title: "13. Contacts",
          paragraphs: [`Artem Vadimovich Maksimov`, contactEmail],
        },
      ],
    },
    consent: {
      title: "Consent to Personal Data Processing",
      shortTitle: "Personal Data Consent",
      updated: "Version dated August 12, 2026",
      intro:
        "This Consent is a separate confirmation concerning personal data processing. In case of discrepancies, the Russian version prevails.",
      sections: [
        {
          title: "1. Recipient of the consent",
          paragraphs: [
            `I freely, specifically, knowingly, and unambiguously consent to the processing of my personal data by Artem Vadimovich Maksimov, the individual operator of TeamFlow AI. Contact: ${contactEmail}.`,
          ],
        },
        {
          title: "2. Purposes",
          items: [
            "Creating, authenticating, and maintaining my account.",
            "Providing TeamFlow AI workspaces, projects, tasks, chat, collaboration, notifications, and file functions.",
            "Providing support and maintaining security and reliable service operation.",
            "Processing plan payments and enabling a paid plan only after payment confirmation.",
            "Running AI Copilot when I submit a request.",
            "Meeting applicable legal obligations.",
          ],
        },
        {
          title: "3. Personal data",
          items: [
            "My name, display name, email, avatar, and profile information.",
            "Account, workspace membership, roles, invitations, and settings.",
            "Projects, tasks, comments, chat messages, and associated activity that I create or that relates to my account.",
            "Files and attachments that I voluntarily upload.",
            "Necessary technical, session, authentication, security, and service-log data.",
            "Selected plan and payment identifier or status, but not full bank-card details handled by YooKassa.",
            "My AI Copilot prompts and the minimum accessible workspace context used to answer them.",
          ],
        },
        {
          title: "4. Processing and providers",
          paragraphs: [
            "I consent to automated collection, recording, organisation, storage, updating, retrieval, use, provision or transfer when necessary for a service function, restriction, deletion, and destruction of the listed data.",
            "The operator may involve providers necessary for the relevant function, including Google OAuth, YooKassa, Supabase Storage, Groq, and hosting or database providers, sharing only the data needed for that function. Their infrastructure may involve processing outside the Russian Federation depending on the production configuration.",
          ],
        },
        {
          title: "5. Duration",
          paragraphs: [
            "This Consent remains valid while my account or relationship with TeamFlow AI exists and until the processing purposes are achieved or I withdraw it, unless another lawful ground requires or permits continued processing.",
          ],
        },
        {
          title: "6. Withdrawal",
          paragraphs: [
            `I may withdraw this Consent by emailing ${contactEmail}. After receiving the withdrawal, the operator will stop consent-based processing and delete data within the limits and timeframes required by applicable law, unless another lawful ground permits or requires continued processing.`,
          ],
        },
        {
          title: "7. Confirmation",
          paragraphs: [
            "By selecting the separate consent checkbox during registration, I confirm that I have read this Consent and the Privacy Policy, understand their contents, and provide this Consent voluntarily.",
          ],
        },
      ],
    },
    terms: {
      title: "TeamFlow AI Terms of Use",
      shortTitle: "Terms of Use",
      updated: "Last updated: August 12, 2026",
      intro:
        "These Terms govern access to and use of TeamFlow AI. By creating an account, you agree to them. In case of discrepancies, the Russian version prevails.",
      sections: [
        {
          title: "1. General provisions",
          paragraphs: [
            `TeamFlow AI is operated by Artem Vadimovich Maksimov, an individual. Legal questions may be sent to ${contactEmail}. These Terms form an agreement between the operator and the user.`,
          ],
        },
        {
          title: "2. About the service",
          paragraphs: [
            "TeamFlow AI provides workspaces, projects, tasks, Kanban, team membership, communications, files, notifications, billing functions, and an AI Copilot. Available features and limits depend on the current plan and service configuration.",
          ],
        },
        {
          title: "3. Registration and account",
          paragraphs: [
            "Users must provide accurate registration information, protect account access, and promptly report suspected unauthorised use. A user is responsible for actions performed through their account unless applicable law provides otherwise.",
          ],
        },
        {
          title: "4. Workspaces and user content",
          paragraphs: [
            "Users retain rights to content they create or upload. They grant the operator a limited right to host, copy, process, and display that content only as needed to provide, secure, and support the service. Workspace owners and members are responsible for their permissions and for having lawful grounds to add other persons' data or content.",
          ],
        },
        {
          title: "5. Acceptable use",
          paragraphs: [
            "The service may be used for lawful team and project work, communication, file collaboration, and other functions made available in the interface, with respect for other users' rights and workspace access rules.",
          ],
        },
        {
          title: "6. Prohibited use",
          items: [
            "Violating law, third-party rights, privacy, confidentiality, or intellectual-property rights.",
            "Uploading malware or content intended to disrupt, damage, or gain unauthorised access to the service or another account.",
            "Attempting to bypass access controls, limits, or security measures, or probing the service without authorisation.",
            "Using the service to distribute unlawful, fraudulent, threatening, or abusive material.",
            "Reselling or materially copying the service without permission, except where applicable law allows it.",
          ],
        },
        {
          title: "7. AI Copilot",
          paragraphs: [
            "AI Copilot uses user prompts and limited accessible workspace context to generate responses. Responses may be incomplete, inaccurate, or outdated and must be checked before being relied upon for important decisions.",
            "AI Copilot is not a source of professional legal, medical, or financial advice. Users remain responsible for how they use generated responses. AI Copilot does not independently modify workspace data through the current interface.",
          ],
        },
        {
          title: "8. Plans and payments",
          paragraphs: [
            "TeamFlow AI may offer Free and paid plans with limits shown in the product. Paid plan activation requires a successfully confirmed YooKassa payment. Payments are one-time plan activations in the current billing model; automatic renewal is not represented as part of the service.",
            "Payment status is determined by the payment provider and confirmed by the server. Refunds, payment errors, and statutory consumer rights are handled according to applicable law and the circumstances of the payment; these Terms do not exclude rights that cannot legally be excluded.",
          ],
        },
        {
          title: "9. Intellectual property",
          paragraphs: [
            "The TeamFlow AI software, interface, brand, and materials supplied by the operator are protected by applicable intellectual-property rules. These Terms grant only a limited, revocable, non-exclusive right to use the service for its intended purpose and do not transfer ownership of the service or the user's content.",
          ],
        },
        {
          title: "10. Operation and availability",
          paragraphs: [
            "The operator aims to keep the service available and secure but does not promise uninterrupted operation or a specific service level. Maintenance, provider failures, security events, and circumstances outside reasonable control may affect availability. Features may be changed where reasonably necessary without removing mandatory statutory rights.",
          ],
        },
        {
          title: "11. Liability",
          paragraphs: [
            "Each party is responsible as provided by applicable law. To the extent permitted by law, the operator is not responsible for losses caused by user actions, unlawful content, compromised credentials, third-party services, or reliance on unverified AI output. Nothing in these Terms limits liability or consumer rights where such limitation is prohibited.",
          ],
        },
        {
          title: "12. Termination",
          paragraphs: [
            "A user may stop using the service and request account or personal-data deletion. The operator may restrict or terminate access for material violations, security threats, legal requirements, or discontinuation of the service, using reasonable notice where circumstances allow. Data handling after termination follows the Privacy Policy and applicable law.",
          ],
        },
        {
          title: "13. Changes to the Terms",
          paragraphs: [
            "The operator may update these Terms. The current version and revision date are published at /terms. Material changes may be communicated through the service where reasonably practicable. Continued use after an updated version takes effect constitutes acceptance where permitted by law.",
          ],
        },
        {
          title: "14. Applicable law",
          paragraphs: [
            "These Terms are governed by the law of the Russian Federation. Disputes should first be addressed to the operator and, if unresolved, may be submitted to the competent authority or court under applicable procedural and consumer-protection rules.",
          ],
        },
        {
          title: "15. Contacts",
          paragraphs: ["Artem Vadimovich Maksimov", contactEmail],
        },
      ],
    },
  },
  ru: {
    privacy: {
      title: "Политика в отношении обработки персональных данных",
      shortTitle: "Политика конфиденциальности",
      updated: "Последнее обновление: 12 августа 2026 года",
      intro:
        "Настоящая Политика объясняет, как обрабатываются персональные данные при использовании сайта и сервиса TeamFlow AI.",
      sections: [
        {
          title: "1. Общие положения",
          paragraphs: [
            "TeamFlow AI — сервис для управления командной работой, проектами, задачами, коммуникациями, файлами и связанными функциями.",
            `Оператор персональных данных — физическое лицо Максимов Артём Вадимович. По вопросам персональных данных и юридическим вопросам можно обратиться по адресу ${contactEmail}.`,
            "Политика применяется к данным, обрабатываемым при использовании сайта и сервиса TeamFlow AI.",
          ],
        },
        {
          title: "2. Основные термины",
          items: [
            "Персональные данные — информация, относящаяся прямо или косвенно к определённому или определяемому физическому лицу.",
            "Обработка персональных данных — любое действие или совокупность действий с персональными данными, включая сбор, запись, хранение, использование, передачу, блокирование, удаление и уничтожение.",
            "Оператор — лицо, определяющее цели и способы обработки персональных данных.",
            "Пользователь — физическое лицо, которое посещает сайт, создаёт аккаунт или использует TeamFlow AI.",
          ],
        },
        {
          title: "3. Какие данные могут обрабатываться",
          items: [
            "Имя, отображаемое имя, email, avatar и иные данные профиля, предоставленные пользователем.",
            "Данные аккаунта, участие в рабочих пространствах, роли, приглашения и настройки пользователя или рабочего пространства.",
            "Проекты, задачи, описания, статусы, приоритеты, сроки, назначения, комментарии и связанная активность.",
            "Сообщения в каналах и личных чатах, реакции, закрепления и служебные данные коммуникаций.",
            "Файлы и вложения, добровольно загруженные в профиль, проекты, задачи или чат.",
            "Технические данные, необходимые для работы и защиты сервиса: IP-адрес, сведения о браузере или устройстве, время запросов, идентификаторы аутентификации и журналы работы, когда они формируются.",
            "Выбранный тариф, идентификатор и статус платежа и служебные сведения для смены тарифа. Полные номера банковских карт и CVV обрабатываются платёжным провайдером и не запрашиваются и не хранятся TeamFlow AI.",
            "Запросы к AI Copilot и минимальный контекст рабочего пространства, необходимый для ответа и доступный запросившему пользователю.",
          ],
        },
        {
          title: "4. Цели обработки",
          items: [
            "Создание, аутентификация и обслуживание аккаунтов.",
            "Работа пространств, проектов, задач, канбана, совместной работы, чата, уведомлений и хранения файлов.",
            "Поддержка пользователей, диагностика сбоев, предотвращение злоупотреблений и защита сервиса.",
            "Проведение платежей, проверка их статуса и предоставление тарифа после успешного серверного подтверждения.",
            "Работа AI Copilot по запросу пользователя и формирование ответов на основе доступного контекста.",
            "Исполнение применимых требований законодательства и разрешение споров.",
          ],
        },
        {
          title: "5. Правовые основания",
          paragraphs: [
            "Обработка осуществляется на основании согласия пользователя, когда оно требуется, для исполнения Условий использования TeamFlow AI, выполнения применимых требований законодательства и на иных предусмотренных законом основаниях, если они применимы к конкретной обработке.",
          ],
        },
        {
          title: "6. Способы и действия с данными",
          paragraphs: [
            "Обработка преимущественно автоматизированная и может включать получение, сбор, запись, систематизацию, накопление, хранение, уточнение, извлечение, использование, предоставление доступа или передачу необходимым поставщикам, блокирование, удаление и уничтожение. Данные не распространяются неопределённому кругу лиц, кроме случаев намеренной публикации пользователем через функцию сервиса или требования закона.",
          ],
        },
        {
          title: "7. Сторонние сервисы и обработчики",
          paragraphs: [
            "TeamFlow AI может использовать Google OAuth для аутентификации, ЮKassa для платежей, Supabase Storage для пользовательских файлов, Groq для AI Copilot, а также инфраструктуру хостинга и базы данных. Каждый поставщик получает только данные, разумно необходимые для соответствующей функции, и обрабатывает их по своим условиям и применимым требованиям.",
            "Отдельные поставщики или их инфраструктура могут находиться за пределами Российской Федерации. Фактическое место обработки и наличие трансграничной передачи зависят от production-конфигурации и договорённостей с поставщиками. TeamFlow AI не утверждает, что все данные хранятся в России, пока это отдельно не подтверждено для production-развёртывания.",
          ],
        },
        {
          title: "8. Cookies и локальное хранилище",
          paragraphs: [
            "Сервис использует необходимые идентификаторы аутентификации или сессии и хранилище браузера для языка, темы, настроек интерфейса, безопасного возврата после входа и временного состояния возврата из оплаты. Эти механизмы нужны для безопасности и основных функций. Клиентская часть TeamFlow AI сейчас не использует рекламные или маркетинговые аналитические cookies.",
          ],
        },
        {
          title: "9. Сроки обработки и удаления",
          paragraphs: [
            "Данные обрабатываются до достижения соответствующей цели, пока существует аккаунт или отношения с пользователем, либо до отзыва согласия, когда оно является основанием обработки. Дольше данные могут храниться только когда это требуется законом или обоснованно необходимо для исполнения обязанностей и разрешения споров. При отсутствии законного основания данные удаляются или уничтожаются с учётом применимых требований и технических процедур.",
          ],
        },
        {
          title: "10. Защита данных",
          paragraphs: [
            "Оператор применяет разумные организационные и технические меры, включая разграничение доступа, аутентификацию, разделение пользовательских полномочий и меры против несанкционированного доступа, изменения, раскрытия или утраты данных. Ни один онлайн-сервис не может гарантировать абсолютную безопасность.",
          ],
        },
        {
          title: "11. Права пользователя",
          items: [
            "Получать информацию об обработке персональных данных.",
            "Требовать уточнения, блокирования или удаления данных в предусмотренных законом случаях.",
            "Отозвать согласие без влияния на законность обработки, выполненной до отзыва.",
            `Обратиться к оператору по адресу ${contactEmail} и осуществлять иные предусмотренные законом права.`,
          ],
        },
        {
          title: "12. Изменение Политики",
          paragraphs: [
            "Оператор может обновлять Политику. Актуальная версия и дата редакции размещаются по адресу /privacy.",
          ],
        },
        {
          title: "13. Контакты",
          paragraphs: ["Максимов Артём Вадимович", contactEmail],
        },
      ],
    },
    consent: {
      title: "Согласие на обработку персональных данных",
      shortTitle: "Согласие на обработку ПД",
      updated: "Редакция от 12 августа 2026 года",
      intro:
        "Настоящее Согласие является отдельным подтверждением пользователя в отношении обработки персональных данных.",
      sections: [
        {
          title: "1. Кому даётся согласие",
          paragraphs: [
            `Я свободно, конкретно, предметно, информированно, сознательно и однозначно даю согласие на обработку моих персональных данных физическому лицу Максимову Артёму Вадимовичу, оператору TeamFlow AI. Контакт: ${contactEmail}.`,
          ],
        },
        {
          title: "2. Цели обработки",
          items: [
            "Создание, аутентификация и обслуживание моего аккаунта.",
            "Предоставление рабочих пространств, проектов, задач, чата, совместной работы, уведомлений и файловых функций TeamFlow AI.",
            "Поддержка, безопасность и надёжная работа сервиса.",
            "Обработка платежа за тариф и включение платного тарифа только после подтверждения оплаты.",
            "Работа AI Copilot, когда я отправляю ему запрос.",
            "Выполнение применимых требований законодательства.",
          ],
        },
        {
          title: "3. Персональные данные",
          items: [
            "Мои имя, отображаемое имя, email, avatar и данные профиля.",
            "Данные аккаунта, участие в рабочих пространствах, роли, приглашения и настройки.",
            "Проекты, задачи, комментарии, сообщения чата и связанная с моим аккаунтом активность.",
            "Файлы и вложения, которые я добровольно загружаю.",
            "Необходимые технические, сессионные, аутентификационные, защитные данные и журналы работы сервиса.",
            "Выбранный тариф и идентификатор или статус платежа, но не полные реквизиты банковской карты, обрабатываемые ЮKassa.",
            "Мои запросы AI Copilot и минимальный доступный мне контекст рабочего пространства, используемый для ответа.",
          ],
        },
        {
          title: "4. Действия с данными и поставщики",
          paragraphs: [
            "Я соглашаюсь на автоматизированные сбор, запись, систематизацию, накопление, хранение, уточнение, извлечение, использование, предоставление или передачу, когда это необходимо для функции сервиса, блокирование, удаление и уничтожение перечисленных данных.",
            "Оператор может привлекать необходимых для соответствующей функции поставщиков, включая Google OAuth, ЮKassa, Supabase Storage, Groq и поставщиков хостинга или базы данных, передавая только необходимые данные. Их инфраструктура может предполагать обработку за пределами Российской Федерации в зависимости от production-конфигурации.",
          ],
        },
        {
          title: "5. Срок действия",
          paragraphs: [
            "Согласие действует, пока существует мой аккаунт или отношения с TeamFlow AI, до достижения целей обработки либо до моего отзыва, если другое законное основание не требует или не допускает продолжения обработки.",
          ],
        },
        {
          title: "6. Отзыв согласия",
          paragraphs: [
            `Я могу отозвать Согласие письмом на ${contactEmail}. После получения отзыва оператор прекратит обработку, основанную на согласии, и удалит данные в пределах и сроки, установленные применимым законодательством, если иное законное основание не позволяет или не требует продолжить обработку.`,
          ],
        },
        {
          title: "7. Подтверждение",
          paragraphs: [
            "Устанавливая отдельный checkbox согласия при регистрации, я подтверждаю, что прочитал настоящее Согласие и Политику в отношении обработки персональных данных, понимаю их содержание и даю Согласие добровольно.",
          ],
        },
      ],
    },
    terms: {
      title: "Условия использования TeamFlow AI",
      shortTitle: "Условия использования",
      updated: "Последнее обновление: 12 августа 2026 года",
      intro:
        "Настоящие Условия регулируют доступ к TeamFlow AI и его использование. Создавая аккаунт, пользователь принимает Условия.",
      sections: [
        {
          title: "1. Общие положения",
          paragraphs: [
            `Оператор TeamFlow AI — физическое лицо Максимов Артём Вадимович. Юридические вопросы можно направлять на ${contactEmail}. Условия образуют соглашение между оператором и пользователем.`,
          ],
        },
        {
          title: "2. О сервисе",
          paragraphs: [
            "TeamFlow AI предоставляет рабочие пространства, проекты, задачи, канбан, управление участниками, коммуникации, файлы, уведомления, функции оплаты и AI Copilot. Доступные функции и лимиты зависят от текущего тарифа и конфигурации сервиса.",
          ],
        },
        {
          title: "3. Регистрация и аккаунт",
          paragraphs: [
            "Пользователь обязан указывать достоверные регистрационные данные, защищать доступ к аккаунту и незамедлительно сообщать о подозрении на несанкционированное использование. Пользователь отвечает за действия через свой аккаунт, если иное не предусмотрено применимым законодательством.",
          ],
        },
        {
          title: "4. Workspace и пользовательский контент",
          paragraphs: [
            "Пользователи сохраняют права на созданный или загруженный контент и предоставляют оператору ограниченное право размещать, копировать, обрабатывать и показывать его только для предоставления, защиты и поддержки сервиса. Владельцы и участники рабочих пространств отвечают за настройки доступа и наличие законных оснований для добавления данных или контента других лиц.",
          ],
        },
        {
          title: "5. Допустимое использование",
          paragraphs: [
            "Сервис можно использовать для законной командной и проектной работы, коммуникаций, совместной работы с файлами и иных доступных в интерфейсе функций с соблюдением прав других лиц и правил доступа рабочего пространства.",
          ],
        },
        {
          title: "6. Запрещённое использование",
          items: [
            "Нарушение закона, прав третьих лиц, приватности, конфиденциальности или интеллектуальных прав.",
            "Загрузка вредоносного кода или материалов для нарушения работы, причинения вреда или получения несанкционированного доступа.",
            "Попытки обойти контроль доступа, лимиты или меры безопасности либо исследовать защищённые компоненты без разрешения.",
            "Распространение через сервис незаконных, мошеннических, угрожающих или оскорбительных материалов.",
            "Перепродажа или существенное копирование сервиса без разрешения, кроме случаев, допускаемых законом.",
          ],
        },
        {
          title: "7. AI Copilot",
          paragraphs: [
            "AI Copilot использует запрос пользователя и ограниченный доступный ему контекст рабочего пространства для формирования ответа. Ответы могут быть неполными, неточными или устаревшими, поэтому значимую информацию необходимо проверять.",
            "AI Copilot не является источником профессиональной юридической, медицинской или финансовой консультации. Пользователь отвечает за использование полученных ответов. В текущем интерфейсе AI Copilot самостоятельно не изменяет данные рабочего пространства.",
          ],
        },
        {
          title: "8. Тарифы и платежи",
          paragraphs: [
            "TeamFlow AI может предлагать Free и платные тарифы с лимитами, указанными в продукте. Платный тариф активируется только после успешно подтверждённого платежа ЮKassa. В текущей модели платежи являются разовой активацией тарифа; автоматическое продление не заявляется как функция сервиса.",
            "Статус платежа определяется платёжным провайдером и подтверждается сервером. Возвраты, платёжные ошибки и обязательные права потребителя рассматриваются по применимому законодательству и обстоятельствам платежа; Условия не исключают права, которые нельзя исключить по закону.",
          ],
        },
        {
          title: "9. Интеллектуальная собственность",
          paragraphs: [
            "Программное обеспечение, интерфейс, бренд и материалы TeamFlow AI, предоставленные оператором, охраняются применимыми нормами об интеллектуальной собственности. Условия дают только ограниченное, отзывное и неисключительное право использовать сервис по назначению и не передают права собственности на сервис или пользовательский контент.",
          ],
        },
        {
          title: "10. Работа и доступность сервиса",
          paragraphs: [
            "Оператор стремится поддерживать доступность и безопасность сервиса, но не обещает непрерывную работу или конкретный SLA. На доступность могут влиять обслуживание, сбои поставщиков, события безопасности и обстоятельства вне разумного контроля. Функции могут изменяться при обоснованной необходимости без ограничения обязательных прав пользователей.",
          ],
        },
        {
          title: "11. Ответственность",
          paragraphs: [
            "Стороны несут ответственность по применимому законодательству. В допустимых законом пределах оператор не отвечает за потери из-за действий пользователя, незаконного контента, утраты контроля над учётными данными, работы сторонних сервисов или доверия непроверенному AI-ответу. Условия не ограничивают ответственность или права потребителя там, где такое ограничение запрещено.",
          ],
        },
        {
          title: "12. Прекращение использования",
          paragraphs: [
            "Пользователь может прекратить использование и запросить удаление аккаунта или персональных данных. Оператор может ограничить или прекратить доступ при существенном нарушении, угрозе безопасности, требовании закона или прекращении сервиса, по возможности направив разумное уведомление. Обработка данных после прекращения регулируется Политикой и законом.",
          ],
        },
        {
          title: "13. Изменение Условий",
          paragraphs: [
            "Оператор может обновлять Условия. Актуальная версия и дата редакции размещаются по адресу /terms. О существенных изменениях при разумной возможности сообщается через сервис. Продолжение использования после вступления новой версии в силу означает принятие там, где это допускается законом.",
          ],
        },
        {
          title: "14. Применимое право",
          paragraphs: [
            "К Условиям применяется право Российской Федерации. Споры следует сначала направить оператору, а при отсутствии решения — в компетентный орган или суд по применимым процессуальным нормам и правилам защиты прав потребителей.",
          ],
        },
        {
          title: "15. Контакты",
          paragraphs: ["Максимов Артём Вадимович", contactEmail],
        },
      ],
    },
  },
};

export function getLegalDocument(lang: Lang, kind: LegalDocumentKind): LegalDocument {
  return documents[lang][kind];
}

export const LEGAL_CONTACT_EMAIL = contactEmail;
