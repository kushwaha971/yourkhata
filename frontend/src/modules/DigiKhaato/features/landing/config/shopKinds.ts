import type { Solution, SolutionGuide } from './solutions';

/** One public guide page per shop kind on the sign-up screen (R-DEC-63).
 *
 * Every page has the same Shop modules — bills, customers, items, purchases,
 * reports — photographed from that kind's own demo shop (e2e/demo/seed-kinds.mjs
 * and shop-kind-shots.mjs), so a jeweller sees grams and gold rings and a
 * kirana sees atta and loose sugar. `special` lists only what that kind's
 * preset switches on and the screens actually draw; nothing here is promised.
 */
interface ShopKind {
  readonly kind: string;
  readonly label: string;
  readonly who: string;
  readonly problem: string;
  /** What the server's preset for this kind switches on, in plain words. */
  readonly special: readonly string[];
  readonly units: string;
  readonly customer: string;
  readonly item: string;
  readonly supplier: string;
  readonly example: readonly string[];
  /** The kind's own words for its people (the server preset's party labels). */
  readonly buyers?: string;
  readonly sellers?: string;
}

const guides = (k: ShopKind): readonly SolutionGuide[] => {
  const buyers = k.buyers ?? 'Customers';
  const seller = (k.sellers ?? 'Suppliers').replace(/ies$/, 'y').replace(/s$/, '').toLowerCase();
  return [
    {
      id: 'guide-dashboard',
      title: 'See your day on the Dashboard',
      steps: [
        'Open Home. The top cards show what you billed today, what you received and what is still to collect.',
        'Below them, Follow-ups lists overdue supplier bills and items running low.',
        'Tap any card to open the list behind it.',
      ],
      shot: 'dashboard',
      alt: `${k.label} dashboard with today's billing, money to collect and follow-ups`,
    },
    {
      id: 'guide-bill',
      title: 'Make a bill',
      steps: [
        'Tap New bill. Choose Quick sale for a walk-in, or Saved customer to bill someone on credit.',
        `Search an item, for example "${k.item}", and tap it. Change the quantity or rate on the line.`,
        'GST is worked out on each line and the total is shown at the bottom.',
      ],
      shot: 'bill',
      clip: 'feat-bill',
      alt: `A new bill for ${k.customer} with ${k.item} added`,
    },
    {
      id: 'guide-bill-payment',
      title: 'Issue the bill and record how it was paid',
      steps: [
        'Tap Issue. Choose Cash, a UPI app, bank, cheque or card, and the amount received.',
        'Choose Full credit if the customer will pay later; it is added to what they owe.',
        'The bill number is given when you issue it. You can print or share it from there.',
      ],
      shot: 'bill-payment',
      alt: 'The Payment sheet with payment modes, amount and Full credit',
    },
    {
      id: 'guide-customers',
      title: 'Know who owes you',
      steps: [
        `Open ${buyers}. Each row shows what they owe and whether it is late.`,
        'Use the chips to see only those To collect or Late.',
        'Tap Remind to send a ready message with the amount on WhatsApp or SMS. You press send.',
      ],
      shot: 'customers',
      clip: 'feat-reminder',
      alt: `${buyers} list with the amount each one owes and Remind buttons`,
    },
    {
      id: 'guide-customer',
      title: "Open a customer's page",
      steps: [
        `Tap a customer, for example ${k.customer}. You see what they owe, their unpaid bills and every payment.`,
        'Add a promise date when they say when they will pay.',
        'New bill and Receive payment are at the top of the page.',
      ],
      shot: 'customer',
      alt: `${k.customer}'s page with unpaid bills and payments`,
    },
    {
      id: 'guide-receive',
      title: 'Receive a payment',
      steps: [
        'On the customer page tap Receive payment. It opens with the whole amount due; change it for a part payment.',
        'Choose how they paid and save. The oldest unpaid bills are settled first.',
        'Print or share the receipt from the confirmation.',
      ],
      shot: 'receive',
      clip: 'feat-khata',
      alt: 'The Receive payment sheet with amount and mode',
    },
    {
      id: 'guide-items',
      title: 'Keep your items and stock',
      steps: [
        `Open Items. Each item shows its stock in its own unit (${k.units}) and its selling price.`,
        'Add an item with its price, GST and opening stock, or import a list.',
        'Items below their reorder level show up as low stock on Home.',
      ],
      shot: 'items',
      alt: `Item list for a ${k.label.toLowerCase()} with stock and prices`,
    },
    {
      id: 'guide-item',
      title: "Check an item's stock card",
      steps: [
        `Open an item, for example ${k.item}. Every sale, purchase and adjustment is listed with the date.`,
        'Tap Adjust stock to correct a count, with a reason.',
      ],
      shot: 'item',
      clip: 'feat-stock',
      alt: `Stock card for ${k.item} with its movements`,
    },
    {
      id: 'guide-purchase',
      title: `Record a purchase from your ${seller}`,
      steps: [
        `Open Purchases and tap New purchase. Choose the ${seller}, for example ${k.supplier}.`,
        'Add items with quantity and cost. Input GST is worked out on each line.',
        'Tap Record purchase and say whether you paid now or will pay later. Stock goes up at once.',
      ],
      shot: 'purchase',
      clip: 'feat-purchase',
      alt: `A purchase from ${k.supplier} with an item added`,
    },
    {
      id: 'guide-reports',
      title: 'Answer your questions with Reports',
      steps: [
        'Open Reports. Each report is a plain question: What happened today? Who has not paid me yet? What do I need to order?',
        'Day book, cash book, money to collect and to pay, stock, sales and purchase registers, profit and the GST summary are here.',
        'Download a report to share with your accountant.',
      ],
      shot: 'reports',
      clip: 'feat-reports',
      alt: 'Reports listed as plain questions',
    },
  ];
};

const page = (k: ShopKind): Solution => ({
  slug: `shop-${k.kind.replace('_', '-')}`,
  media: `shop/${k.kind}`,
  name: `${k.label} billing and stock`,
  title: `${k.label} Billing & Stock App | YourKhata`,
  description: `GST bills, stock, purchases and customer dues for a ${k.label.toLowerCase()} — on phone or computer. Step-by-step guides with real screens.`,
  audience: k.who,
  problem: k.problem,
  summary: `YourKhata's Business app for a ${k.label.toLowerCase()}: make GST bills, keep stock in ${k.units}, record purchases, see who owes you and remind them. ${k.special.join(' ')}`,
  highlights: [
    'GST bills on phone or computer',
    'Stock goes up and down with every bill',
    'Who owes you, bill by bill',
    'Sign in with your mobile and a WhatsApp code',
  ],
  features: [
    ...k.special,
    'Make GST bills for walk-in or saved customers, paid now or on credit.',
    'Record purchases; stock and input GST update by themselves.',
    'See each customer’s unpaid bills and send a ready reminder.',
    'Reports for the day, stock, dues, sales, purchases, profit and GST.',
  ],
  steps: [
    `Sign in with your mobile number and choose ${k.label} as your kind of shop.`,
    'Add your items with price, GST and opening stock, and your customers and suppliers.',
    'Make bills and record purchases as they happen; check Home and Reports at the end of the day.',
  ],
  example: { title: `A morning at a ${k.label.toLowerCase()}`, steps: k.example },
  cases: [
    {
      title: 'Illustrative: closing the day in five minutes',
      body: `A ${k.label.toLowerCase()} owner opens the Day book at closing time, checks cash against bills, and sends reminders to the three customers who are late — without opening a notebook.`,
    },
  ],
  limitsTitle: `What the ${k.label} guide does not cover`,
  limits: [
    'YourKhata keeps records and makes GST bills; it does not file GST returns for you. Check with your accountant.',
    'Reminders are prepared for you to send on WhatsApp or SMS; nothing is sent without you pressing send.',
    'The screens here are from a demo shop; names and figures are made up.',
  ],
  guides: guides(k),
  questions: [
    {
      question: `Is YourKhata made for a ${k.label.toLowerCase()}?`,
      answer: `Yes. When you choose ${k.label} at sign-up, the app starts with units like ${k.units} and the features listed on this page switched on. You can change them in Settings.`,
    },
    {
      question: 'Can I use it on my phone?',
      answer:
        'Yes. Every screen on this page works on a phone and on a computer; the guides show both.',
    },
    {
      question: 'Can customers buy on credit?',
      answer:
        'Yes. Issue a bill on Full credit and it is added to what that customer owes. Their page shows each unpaid bill until it is paid.',
    },
  ],
});

const KINDS: readonly ShopKind[] = [
  {
    kind: 'kirana',
    label: 'Kirana store',
    who: 'Kirana and general stores that sell packed and loose groceries, with regular customers on credit.',
    problem:
      'Loose items, regular customers on udhaar and suppliers to pay — kept in a notebook, nobody knows what stock is left or who owes what.',
    special: [
      'Sell loose items by amount — type ₹20 and the app works out the weight.',
      'Take phone orders and turn them into bills.',
    ],
    units: 'kg, grams, litres and packets',
    customer: 'Sunita Patil',
    item: 'Aashirvaad Atta 10kg',
    supplier: 'Laxmi Wholesale',
    example: [
      'Sunita buys 2 bags of atta and 3 kg sugar on credit; the bill is issued on Full credit.',
      'Raju pays ₹500 of what he owes; it is received on his page.',
      'Parle-G shows as low stock on Home, so it goes on the order list.',
    ],
  },
  {
    kind: 'electronics',
    label: 'Electrical, electronics & mobile shop',
    who: 'Mobile, electronics and electrical shops that sell phones and appliances with serial numbers, and wire and fittings to contractors.',
    problem:
      'Phones sold without a record of the IMEI, contractors buying for many sites on credit, and stock counted only when it runs out.',
    special: [
      'Keep the IMEI or serial number of each phone and appliance on the bill.',
      'Bill a contractor site by site.',
    ],
    units: 'pieces, sets, boxes and metres',
    customer: 'Anil Mobile Repair',
    item: 'Redmi 13C 4/128',
    supplier: 'Mehta Distributors',
    example: [
      'A Redmi phone is billed with its IMEI on the line.',
      'Om Construction takes wire and bulbs for a site on credit.',
      'Wire by the metre runs low and shows on Home.',
    ],
  },
  {
    kind: 'jewellery',
    label: 'Jewellery shop',
    who: 'Jewellers selling gold and silver by weight, with making charges and orders.',
    problem:
      'Weight, purity, today’s rate and making charges worked out on a calculator for every bill, and orders kept on slips.',
    special: [
      'Bill by weight with today’s gold and silver rate.',
      'Print tags for jewellery items.',
    ],
    units: 'grams and pieces',
    customer: 'Rekha Bansal',
    item: 'Gold Ring 22K',
    supplier: 'Zaveri Bullion',
    example: [
      'A 22K gold ring is billed by grams at today’s rate, with 3% GST.',
      'A wedding order is billed on credit and paid in parts.',
      'Silver coins run low and show on Home.',
    ],
  },
  {
    kind: 'hardware',
    label: 'Hardware & paint shop',
    who: 'Hardware, sanitary and paint shops that sell to contractors and carpenters for many sites.',
    problem:
      'Contractors take material for several sites on credit, and nobody can say later which site took what.',
    special: ['Bill a contractor site by site.', 'Keep stock in pieces, boxes, metres and litres.'],
    units: 'pieces, boxes, metres and litres',
    customer: 'Om Construction',
    item: 'Asian Paints Tractor Emulsion 20L',
    supplier: 'Bharat Paint Depot',
    example: [
      'Om Construction takes paint and Fevicol for a site on credit.',
      'A carpenter pays cash for screws; it is a Quick sale.',
      'Screws by the box run low and show on Home.',
    ],
  },
  {
    kind: 'wholesale',
    label: 'Wholesale business',
    who: 'Wholesalers and traders selling bags and boxes to shops on credit.',
    problem:
      'Large credit bills to many shops, company schemes to apply, and dues that grow without anyone noticing.',
    special: [
      'Running company schemes are applied on the bill by themselves.',
      'Take orders and turn them into bills.',
    ],
    buyers: 'Retailers',
    sellers: 'Companies',
    units: 'bags, boxes, kg and quintals',
    customer: 'Gupta Kirana Store',
    item: 'Basmati Rice 25kg bag',
    supplier: 'Mahalaxmi Mills',
    example: [
      'Gupta Kirana takes 2 bags of rice and 3 of sugar on credit.',
      'Old dues shows who has not paid for more than 30 days.',
      'Salt boxes run low and show on Home.',
    ],
  },
  {
    kind: 'medical',
    label: 'Medical store',
    who: 'Chemists and medical stores that track batch and expiry.',
    problem:
      'Medicines sold without knowing which batch went out, and expired stock found only on the shelf.',
    special: ['Keep batch number and expiry; each bill line shows which batch it takes.'],
    sellers: 'Distributors',
    units: 'pieces, boxes, bottles and packs',
    customer: 'Dr. Kulkarni Clinic',
    item: 'Paracetamol 650 (strip of 15)',
    supplier: 'Sanjivani Pharma Agency',
    example: [
      'A clinic buys paracetamol strips on credit; the batch is on the line.',
      'A walk-in pays cash for ORS; it is a Quick sale.',
      'Thermometers run low and show on Home.',
    ],
  },
  {
    kind: 'garments',
    label: 'Clothes & shoes shop',
    who: 'Clothing, saree and footwear shops selling sizes and colours.',
    problem: 'The same shirt in five sizes and three colours, and no idea which size is finished.',
    special: ['Keep sizes and colours of the same item.'],
    units: 'pieces, pairs and sets',
    customer: 'Neha Shah',
    item: 'Cotton Shirt',
    supplier: 'Surat Textiles',
    example: [
      'A school buys shirts and jeans on credit for uniforms.',
      'A walk-in buys a kurti and pays by UPI.',
      'Sports shoes run low and show on Home.',
    ],
  },
  {
    kind: 'auto_parts',
    label: 'Auto parts shop',
    who: 'Auto spare parts and lubricant shops selling to garages and mechanics.',
    problem:
      'Parts asked for by number, garages paying at month end, and fast-moving parts running out.',
    special: ['Find and bill parts by part number.'],
    units: 'pieces, sets, litres and boxes',
    customer: 'Bajaj Service Garage',
    item: 'Brake Shoe (Splendor)',
    supplier: 'Pune Auto Distributors',
    example: [
      'A garage takes brake shoes and engine oil on credit.',
      'A mechanic pays cash for a clutch plate.',
      'Spark plugs run low and show on Home.',
    ],
  },
  {
    kind: 'stationery',
    label: 'Stationery, books & xerox shop',
    who: 'Stationery, book and xerox shops selling to students, schools and offices.',
    problem:
      'Small sales all day, school orders on credit, and xerox and printing that is not an item at all.',
    special: ['Bill services like xerox and printing alongside items.'],
    units: 'pieces, packs, boxes and dozens',
    customer: 'Sunrise English School',
    item: 'Classmate Notebook 172 pages',
    supplier: 'Navneet Agency',
    example: [
      'A school takes notebooks and pens on credit for the term.',
      'A student pays cash for a geometry box.',
      'Geometry boxes run low and show on Home.',
    ],
  },
  {
    kind: 'agri',
    label: 'Agri inputs shop',
    who: 'Fertiliser, seed and pesticide shops selling to farmers, often on credit until harvest.',
    problem:
      'Farmers buy on credit until harvest, seeds and pesticides have batches and expiry, and the season’s stock must be right.',
    special: ['Keep batch number and expiry for seeds and pesticides.'],
    units: 'kg, bags, litres and packets',
    customer: 'Shankar Patil (Farmer)',
    item: 'Urea 45kg bag',
    supplier: 'Mahadhan Fertilisers',
    example: [
      'A farmer takes urea and seeds on credit until harvest.',
      'The co-op society pays part of its dues.',
      'Pesticide runs low and shows on Home.',
    ],
  },
  {
    kind: 'furniture',
    label: 'Furniture & home shop',
    who: 'Furniture and home shops selling big items, often paid in parts.',
    problem: 'A sofa paid in three parts, deliveries to track, and few but costly items in stock.',
    special: ['Keep sizes and finishes of the same item.'],
    units: 'pieces, sets and square feet',
    customer: 'Deshmukh Family',
    item: 'Sofa Set 3+1+1',
    supplier: 'Godrej Dealer Pune',
    example: [
      'The Deshmukh family buys a sofa set and pays in parts.',
      'A hotel orders plastic chairs on credit.',
      'Study tables run low and show on Home.',
    ],
  },
  {
    kind: 'food',
    label: 'Sweets, bakery & café',
    who: 'Sweet shops, bakeries and cafés selling by weight and taking orders for functions.',
    problem: 'Sweets by the kilo, cake orders for functions on credit, and caterers who pay later.',
    special: ['Take orders for functions and turn them into bills.'],
    units: 'kg, pieces and packets',
    customer: 'Mahesh Caterers',
    item: 'Kaju Katli',
    supplier: 'Amul Distributor',
    example: [
      'A caterer takes 2 kg kaju katli and gulab jamun on credit.',
      'A walk-in buys bread and pays cash.',
      'Birthday cakes run low and show on Home.',
    ],
  },
];

export const SHOP_KIND_SOLUTIONS: readonly Solution[] = KINDS.map(page);
