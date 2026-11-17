/** Public solution pages describe shipped workflows, not future module promises.
 * Add a reviewed entry here when a new module launches; routes and sitemap follow it.
 */
export interface Solution {
  readonly slug: string;
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly audience: string;
  readonly problem: string;
  readonly features: readonly string[];
  readonly steps: readonly string[];
  readonly questions: readonly { question: string; answer: string }[];
  /** A short, self-contained answer an AI search tool can quote (GEO). */
  readonly summary?: string;
  /** One worked example, every figure checked against the module's own rules. */
  readonly example?: { readonly title: string; readonly steps: readonly string[] };
  /** Made-up examples, always labelled Illustrative: there are no customer stories yet. */
  readonly cases?: readonly { readonly title: string; readonly body: string }[];
  /** What the module does not do, stated as plainly as what it does. */
  readonly limitsTitle?: string;
  readonly limits?: readonly string[];
  /** Step-by-step guides, each photographed from the demo book on a phone and a computer. */
  readonly guides?: readonly SolutionGuide[];
  /** A silent walkthrough recorded from the demo book, phone and desktop cuts. */
  readonly video?: {
    readonly base: string;
    readonly title: string;
    readonly description: string;
    readonly seconds: number;
    readonly recorded: string;
  };
  /** Folder under /media/guides/ holding the guide screenshots; the slug when absent. */
  readonly media?: string;
  /** One-line facts for the hero, each true of the module as built. */
  readonly highlights?: readonly string[];
}
export interface SolutionGuide {
  readonly id: string;
  readonly title: string;
  readonly steps: readonly string[];
  /** Screenshot base name under /media/guides/<module>/, without size or extension. */
  readonly shot: string;
  readonly alt: string;
  /** A home-page loop (`/media/landing/<clip>-<size>`) showing this job end to end. */
  readonly clip?: string;
}
import { SHOP_KIND_SOLUTIONS } from './shopKinds';

export const SOLUTIONS: readonly Solution[] = [
  {
    slug: 'shop-billing',
    name: 'Business billing and inventory',
    title: 'Business Billing & Inventory Software | YourKhata',
    description:
      'Create GST bills, track stock, record purchases and follow customer dues with YourKhata. Business records in one place, on phone or computer.',
    audience:
      'Shops and businesses that sell products and need a clear record of stock, sales and customer balances.',
    problem:
      'A bill in one book, stock in a spreadsheet and unpaid balances in messages make it difficult to know what sold and what is still owed.',
    features: [
      'Create sales invoices and GST bills, with credit notes and delivery challans.',
      'Record purchases and view stock movements and low-stock items.',
      'Keep customer and supplier balances alongside recorded payments.',
      'Review sales, purchases, expenses and business reports.',
    ],
    steps: [
      'Add your business, customers, suppliers and items.',
      'Record opening stock, purchases and sales as they happen.',
      'Review balances and reports before following up on dues.',
    ],
    questions: [
      {
        question: 'Can I track billing and inventory together?',
        answer:
          'Yes. The Business module includes sales, purchases and inventory records, alongside customer and supplier accounts.',
      },
      {
        question: 'Does YourKhata replace tax filing advice?',
        answer:
          'No. YourKhata helps record GST bills and produce business reports. Check tax treatment and filing obligations with your accountant.',
      },
    ],
  },
  {
    slug: 'library-management',
    name: 'Library and study-space management',
    title: 'Library & Study-Space Management | YourKhata',
    description:
      'Manage library members, seats, attendance, fees, books and lending records with YourKhata. Keep daily library work together in one browser-based platform.',
    audience:
      'Independent libraries and reading or study spaces that manage memberships, seats, attendance or a book collection.',
    problem:
      'Separate registers for members, seat assignments, fees and book loans make daily checks and payment follow-ups harder.',
    features: [
      'Maintain member records, memberships and seat assignments.',
      'Record attendance and use the member self check-in workflow.',
      'Track fees and library money records.',
      'Manage a book catalogue, copies, issue and return records.',
    ],
    steps: [
      'Set up your library, seats and membership options.',
      'Add members and your book catalogue when applicable.',
      'Record attendance, fees and book movements in the daily workflow.',
    ],
    questions: [
      {
        question: 'Is this only for libraries that lend books?',
        answer:
          'No. The module also supports members, seats, attendance and fees for reading and study spaces. Book catalogue and circulation workflows are available when needed.',
      },
      {
        question: 'Can staff use the same platform?',
        answer:
          'YourKhata includes team access and roles. Assign permissions appropriate to each staff member rather than sharing the owner login.',
      },
    ],
  },
  {
    slug: 'lending-collections',
    media: 'ledger',
    name: 'Ledger for loans and collections',
    title: 'Daily Collection & Loan Record App for Small Lenders | YourKhata',
    description:
      "Record loans, see the full collection schedule before you save, and walk today's round knowing who is due, late or paid. Daily, weekly or monthly.",
    audience:
      'Small lenders who collect daily, weekly or monthly on a route, and any business that keeps records of its own lawful lending.',
    problem:
      'A paper line register works until someone pays half, misses three days, or ₹500 is written as ₹5,000. Then nobody can say at night how much is still out.',
    summary:
      "YourKhata Ledger keeps a small lender's loan register. For each loan you enter the amount lent, any charges, how often you collect (daily, weekly or monthly), how many times and how much each time. YourKhata works out every due date, then counts each collection against them, oldest first, so every loan shows what is collected, what is late and what is left. Reminders open in WhatsApp for you to send; nothing is sent by itself.",
    features: [
      'Give a loan and see the whole schedule before saving: what you will collect, what is in hand and what it earns.',
      'Daily, weekly or monthly, 1 to 400 collections; daily loans can skip Sundays.',
      "Today's round for each route: every stop marked Late, Due today, Collected or Not paid.",
      'Collect in cash or UPI, in full or in part. Money pays the oldest due first, and the last rupee closes the loan.',
      'Record a visit where nothing was paid, with the reason and the day they promised.',
      'Late, due-today and due-tomorrow reminders that open in WhatsApp, signed with your name and UPI ID.',
      'Remove a wrong collection with a reason; the original stays in the history.',
      'Close a loan as paid in full, or write it off.',
      'Routes and borrowers, staff with their own roles, and running loans brought in from your paper register.',
    ],
    steps: [
      'Start with your mobile number and choose Ledger as your module.',
      'Add your routes and borrowers, or import running loans from your register.',
      "Give a loan, check its schedule, and collect on today's round.",
    ],
    example: {
      title: 'One loan, worked through',
      steps: [
        'Lent ₹20,000 with ₹1,000 charges: daily, 100 collections of ₹220, skipping Sundays.',
        'Before saving: To collect ₹22,000 · In hand ₹19,000 · Earns ₹3,000, and the last collection day.',
        'Day one they pay ₹150 of ₹220. The ₹70 left shows as late until it is paid.',
      ],
    },
    cases: [
      {
        title: 'A daily-collection lender with two routes',
        body: 'Sixty running daily loans and one collector per route. Each morning the collector opens Today for their route; at night the owner sees what came in and who is late.',
      },
      {
        title: 'A shop that also lends monthly',
        body: 'A shop owner gives a few monthly loans. Ledger is its own module with its own book, so loan money never mixes with shop sales.',
      },
    ],
    highlights: [
      'Daily, weekly or monthly',
      'Part payments and late amounts',
      'Reminders open in WhatsApp',
      'Works on any phone',
    ],
    video: {
      base: '/media/guides/ledger/tutorial',
      title: 'Ledger in 30 seconds: collect, check a loan, give a new one',
      description:
        "A walkthrough on a demo business: collect ₹150 of a ₹220 day, see the loan update, preview a ₹20,000 daily loan and open the day's reminders.",
      seconds: 30,
      recorded: '2026-11-17',
    },
    guides: [
      {
        id: 'guide-new-loan',
        title: 'Give a new loan',
        shot: 'new-loan',
        alt: 'New loan screen: ₹20,000 lent, Daily · 100 days, ₹220 each day, ₹1,000 charges, preview shows ₹22,000 to collect',
        steps: [
          'Open Borrowers and add the person once: name, mobile, work and route.',
          'Tap New loan and choose the borrower.',
          'Enter Amount lent, pick a Plan such as Daily · 100 days, and enter what they pay each day.',
          'Add Charges taken at start if you keep some back when handing over the money.',
          'Read the preview: to collect, given in hand and the last day. Then tap Save loan.',
        ],
      },
      {
        id: 'guide-today',
        title: "Walk today's round",
        shot: 'today',
        alt: "Today screen: four stops on the round, each with today's due, the late amount, Not paid and Collect",
        steps: [
          'Open Today. Pick a Route to see only that line.',
          'Each stop shows what is due today and what is already late.',
          'The bar at the top shows what you have collected out of what is due today.',
        ],
      },
      {
        id: 'guide-collect',
        title: 'Collect money, full or part',
        shot: 'collect',
        alt: 'Collect sheet for Geeta Devi: ₹150 typed, Cash chosen, after this ₹140 still late',
        steps: [
          'Tap Collect on the stop.',
          'Tap Today, Today + late, or type the amount they gave.',
          'Choose Cash or UPI. The sheet shows what will still be late after this.',
          'Leave Share receipt on WhatsApp on to send them a receipt, then tap Save.',
        ],
      },
      {
        id: 'guide-not-paid',
        title: 'Mark not paid, with a promise date',
        shot: 'not-paid',
        alt: 'Not paid sheet: reasons Shop closed, Not at home, No money today, Will pay later, and a promised date',
        steps: [
          'Tap Not paid on the stop.',
          'Pick the reason, and the day they promised to pay if they gave one.',
          'Tap Save. If they pay later the same day, collecting clears it.',
        ],
      },
      {
        id: 'guide-loan',
        title: 'Check one loan and fix a mistake',
        shot: 'loan',
        alt: 'Loan L-0001: lent ₹20,000, collected ₹1,030, late ₹290, left ₹20,970, with the schedule and collections',
        steps: [
          'Open a loan from Loans or from the stop.',
          'See lent, collected, late and left, the schedule day by day and every collection.',
          'Entered a wrong amount? Tap ⋯, then Remove last collection, and write why. It stays in the history, marked removed.',
          'When everything is collected, Close loan. If money will never come, Write off.',
        ],
      },
      {
        id: 'guide-messages',
        title: 'Send reminders on WhatsApp',
        shot: 'messages',
        alt: 'Messages screen: Late, Due today and Due tomorrow lists with the reminder text and a WhatsApp button',
        steps: [
          'Open Messages and pick Late, Due today or Due tomorrow.',
          'Read the text. Tap Edit text to change it.',
          'Tap WhatsApp. It opens with the text for one borrower at a time; you press send.',
        ],
      },
      {
        id: 'guide-settings',
        title: 'Put your name and UPI ID on messages',
        shot: 'settings',
        alt: 'Lending settings: Name on messages and UPI ID',
        steps: [
          'Open More, then Lending settings.',
          'Enter the Name on messages and your UPI ID, then Save. Every reminder and receipt carries them.',
        ],
      },
    ],
    limitsTitle: 'What Ledger does not do',
    limits: [
      'It does not give loans, check credit or approve borrowers.',
      'It does not send SMS or WhatsApp by itself. You press send.',
      'There is no interest field: earnings are what you collect, minus what you lent, plus charges.',
      'Daily loans skip Sundays only; there is no holiday calendar yet.',
    ],
    questions: [
      {
        question: 'How do I record a half payment?',
        answer:
          "Collect the amount they gave. It pays the oldest due first, and whatever is unpaid shows as late on the loan and on today's round until it is collected.",
      },
      {
        question: 'Can I bring loans from my paper register?',
        answer:
          "Yes. Import a file with each loan and what was collected so far. That amount comes in as past collection, never as today's cash.",
      },
      {
        question: 'I entered a wrong amount. Can I change it?',
        answer:
          'Remove the collection with a reason and enter it again. The original stays in the history, so the record makes sense later.',
      },
      {
        question: 'Does YourKhata provide loans or approve borrowers?',
        answer:
          'No. YourKhata is record-keeping software. It does not provide credit, make lending decisions or grant lending licences.',
      },
      {
        question: 'Can I manage a shop and lending records with one account?',
        answer:
          'Yes. Each module keeps its own book under one login, so shop money and loan money stay separate, and staff see only what their role allows.',
      },
    ],
  },
  ...SHOP_KIND_SOLUTIONS,
];
export const solutionBySlug = (slug: string): Solution | undefined =>
  SOLUTIONS.find((solution) => solution.slug === slug);
