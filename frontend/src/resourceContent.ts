// What each predicted need means and where to actually get it.
// Keys are the exact need strings from situationPatterns.ts; resourceContent.test.ts
// fails if a need is added or renamed there without a card here.
// Like the needs, cards stay logistics-only: where to go and what to bring.
// Where details vary by state or by disaster, cards stay general and point to 211
// rather than inventing specifics that could be wrong.

export type ResourceCard = {
  summary: string // what this need is, in plain words
  whereToGo: string[] // real places to get it, most useful first
  tip?: string // the one thing people most often wish they'd known
}

const CALL_211 = 'Call 211 (free, confidential, 24/7 in most of the US) or visit 211.org for local help'
const FEMA_DECLARED =
  'FEMA help only opens after a federal disaster declaration that covers your county. If it has not been declared yet, register later; 211 can tell you the status.'

export const resourceContent: Record<string, ResourceCard> = {
  // Evacuee with dependents
  'Find a shelter with space for families': {
    summary:
      'A shelter where your family can stay together. Many large shelters set aside quieter family areas, and some have supervised play spaces for kids.',
    whereToGo: [
      'Red Cross open shelter map at redcross.org, or call 1-800-RED-CROSS (1-800-733-2767)',
      CALL_211,
      'The FEMA App and the Red Cross Emergency app both list open shelters near you',
    ],
    tip: 'Tell staff at check-in how many children you have and their ages. Family space is assigned first come, first served.',
  },
  "Pick up diapers, formula and other children's supplies": {
    summary:
      'Free baby and kid supplies handed out after a disaster: diapers, wipes, formula, and sometimes car seats and cribs.',
    whereToGo: [
      'Shelters and relief distribution points (your county emergency management office announces locations)',
      'Your local diaper bank (find one at nationaldiaperbanknetwork.org)',
      'Your WIC office, if you use WIC, to replace lost formula and benefits',
      CALL_211,
    ],
  },
  "Check your school's status and how to re-enroll": {
    summary:
      "Whether your child's school is open, where reunification or pickup is happening, and how to enroll somewhere new if you've moved.",
    whereToGo: [
      "Your school district's website, social media and text alerts",
      "The district's McKinney-Vento (homeless education) liaison, reachable through the district office",
    ],
    tip: 'Under the federal McKinney-Vento Act, children displaced by a disaster can enroll in school right away, even without records, and may be able to stay at their original school with transportation provided.',
  },
  'Arrange free or emergency childcare': {
    summary:
      'Short-term, supervised care for your kids while you deal with applications, inspections and appointments.',
    whereToGo: [
      "Ask at your shelter or FEMA Disaster Recovery Center: groups like Children's Disaster Services set up free childcare there",
      'Your local child care resource and referral agency (find it at childcareaware.org)',
      CALL_211,
    ],
  },

  // Needs replacement documents
  'Write down every document that is missing': {
    summary:
      'One list of everything lost, so you can replace things in the right order and answer questions on aid applications.',
    whereToGo: ['Paper and pen, or the notes app on your phone'],
    tip: "Include IDs, Social Security cards, birth certificates, passports, insurance policies, deeds or leases, vehicle titles and bank cards. Start with whatever ID you still have: one ID makes replacing the others much easier.",
  },
  "Replace your driver's license or state ID": {
    summary: 'A new license or state ID. Most other replacements and aid applications ask for one.',
    whereToGo: [
      "Your state DMV's website, which often lets you order a replacement online",
      'A DMV office, or a DMV table at a FEMA Disaster Recovery Center if your state sets one up',
    ],
    tip: 'Many states waive or reduce replacement fees after a declared disaster, but rules differ by state, so ask before you pay.',
  },
  'Order a replacement birth certificate': {
    summary: 'A certified copy of your birth certificate, used to prove identity and citizenship.',
    whereToGo: [
      'The vital records office of the state where you were born, not where you live now',
      'The CDC "Where to Write for Vital Records" page lists every state\'s office, fees and how to order',
    ],
    tip: 'Order directly from the state or county office. Third-party sites charge extra for the same document.',
  },
  'Request a replacement Social Security card': {
    summary: 'A new Social Security card. Replacements are free.',
    whereToGo: [
      'ssa.gov: in many states you can request a replacement online with a my Social Security account',
      'Social Security at 1-800-772-1213, or a local Social Security office',
    ],
    tip: 'You usually need your number, not the card. FEMA and most aid forms just ask for the number.',
  },
  'Ask your bank and insurer for new cards and policy copies': {
    summary: 'Replacement debit and credit cards, and copies of your home, renters and auto policies so you can file claims.',
    whereToGo: [
      "Your bank's and card issuers' phone numbers (on their websites). Most can send a new card or let you withdraw cash at a branch with ID.",
      "Your insurance agent or the insurer's claims line for policy copies and your policy number",
      "Your state insurance department, if you can't remember which company insures you",
    ],
  },

  // Pet owner evacuee
  'Find a pet-friendly shelter or emergency boarding': {
    summary:
      'A place where your pet can stay with you or nearby. Many disaster shelters set up a pet shelter next door.',
    whereToGo: [CALL_211, 'Your local animal shelter, humane society or animal control', 'Ask at any Red Cross shelter whether a pet shelter is co-located'],
    tip: 'Service animals must be allowed into any public shelter, pet-friendly or not.',
  },
  'Pick up pet food, a leash and a carrier': {
    summary: 'Free pet food and basic gear handed out after a disaster.',
    whereToGo: [
      'Relief distribution points and pet shelters',
      'Local animal shelters and humane societies, many of which run pet food pantries',
      CALL_211,
    ],
  },
  "Get copies of your pet's vaccination records": {
    summary: "Proof your pet's shots are current. Pet shelters and boarding usually ask for rabies at minimum.",
    whereToGo: [
      'Call or email your vet clinic. Most can send records the same day.',
      "If you don't know the clinic, the number on your pet's rabies tag traces back to it",
    ],
  },
  "Update the contact details on your pet's tag or microchip": {
    summary: "Your current phone number on your pet's tag and microchip, so you can be reached if you're separated.",
    whereToGo: [
      "Look up which registry your pet's chip uses at petmicrochiplookup.org, then update your details there",
      "Any vet or animal shelter can scan your pet to read the chip number",
    ],
    tip: "Use a cell number that will still work if you can't go home.",
  },
  'Look for pet-friendly housing for the weeks ahead': {
    summary: 'A place to live that takes pets while your home is repaired or you find a new one.',
    whereToGo: [
      'Tell FEMA and any housing caseworker about your pets when you register',
      'Friends or family nearby, or a boarding facility for the short term',
      CALL_211,
    ],
  },

  // Elderly or mobility-limited evacuee
  'Ask for an accessible shelter space': {
    summary:
      'A shelter space that works for someone who uses a wheelchair or walker, needs help with daily tasks or can\'t manage stairs.',
    whereToGo: [
      'Any public shelter. They are required to accommodate people with disabilities, so tell staff what is needed at check-in.',
      'Red Cross shelters at 1-800-RED-CROSS (1-800-733-2767)',
      CALL_211,
    ],
    tip: 'A caregiver can stay with the person, and you can ask for a cot near the restroom or a quieter area.',
  },
  'Book accessible transportation': {
    summary: 'Rides in vehicles that fit a wheelchair or walker, to shelters, aid centers and appointments.',
    whereToGo: [
      "Your local transit agency's paratransit service",
      'Your local Area Agency on Aging, through the Eldercare Locator at 1-800-677-1116',
      'Shelter staff, who often coordinate shuttles',
      CALL_211,
    ],
  },
  'Borrow or replace mobility equipment': {
    summary: 'A wheelchair, walker, cane or scooter to use while yours is lost or damaged.',
    whereToGo: [
      'Ask at your shelter or a FEMA Disaster Recovery Center',
      'Your local Center for Independent Living, many of which run equipment loan closets',
      CALL_211,
    ],
    tip: 'List lost equipment when you register with FEMA. Some disaster-damaged personal property can be covered.',
  },
  'Get a case manager through your Area Agency on Aging': {
    summary: 'One person who helps an older adult work through housing, benefits and services, instead of doing it all alone.',
    whereToGo: ['Eldercare Locator at 1-800-677-1116 or eldercare.acl.gov, which connects you to your local Area Agency on Aging'],
  },
  'Update the mailing address for benefit payments': {
    summary: "Making sure checks and benefit letters reach you while you're away from home.",
    whereToGo: [
      'ssa.gov (my Social Security) or 1-800-772-1213 to change your address',
      "USPS: forward mail at usps.com/move, and check USPS service alerts for where to pick up mail if your area's delivery is stopped",
    ],
    tip: "Benefits paid by direct deposit keep arriving even when mail doesn't.",
  },

  // Financial hardship
  'Get free meals and groceries': {
    summary: 'Free hot meals and groceries for anyone affected. No proof of income needed at most sites.',
    whereToGo: [
      'Shelters and disaster meal sites run by groups like the Red Cross and the Salvation Army',
      'Your local food bank (find one at feedingamerica.org)',
      CALL_211,
    ],
  },
  'Apply for FEMA disaster assistance': {
    summary:
      'Money from FEMA for disaster costs like housing, essential items and, in some disasters, a one-time payment for immediate needs like food, water and fuel.',
    whereToGo: [
      'DisasterAssistance.gov, the FEMA App, or 1-800-621-3362',
      'A FEMA Disaster Recovery Center in person (find one in the FEMA App)',
    ],
    tip: `${FEMA_DECLARED} FEMA never charges to apply. Anyone asking for a fee is a scammer.`,
  },
  'Apply for disaster food benefits (D-SNAP)': {
    summary:
      "Short-term food benefits on an EBT card for households hit by a disaster, including people who don't normally qualify for SNAP.",
    whereToGo: ["Your state's SNAP (food stamps) agency website", CALL_211],
    tip: 'D-SNAP only opens in some disasters, and the sign-up window is usually short, about a week. If you already get SNAP, ask for replacement benefits for food lost in the disaster.',
  },
  'File for Disaster Unemployment Assistance': {
    summary:
      "Weekly payments if you lost work because of the disaster and don't qualify for regular unemployment. This includes self-employed and gig workers.",
    whereToGo: ["Your state's unemployment agency"],
    tip: 'The deadline is usually 30 days after the disaster is declared, so apply early.',
  },
  'Ask your bank, landlord and lenders to pause payments': {
    summary: 'Pausing or lowering payments for a while so bills don\'t pile up while you recover.',
    whereToGo: [
      'Your mortgage servicer (the number on your statement): most mortgages, especially federally backed ones, offer disaster forbearance',
      'Your credit card companies, car lender and utilities: ask for disaster hardship relief and waived late fees',
      'Your landlord, and free legal aid through 211 if you have questions about rent or your lease',
    ],
    tip: 'The IRS usually extends tax deadlines automatically for declared disaster areas. Check irs.gov.',
  },

  // Needs temporary housing
  'Find an open shelter for tonight': {
    summary: 'A safe, free place to sleep tonight, with cots, meals and restrooms.',
    whereToGo: [
      'Red Cross open shelter map at redcross.org, or 1-800-RED-CROSS (1-800-733-2767)',
      CALL_211,
      'The FEMA App or the Red Cross Emergency app',
    ],
    tip: 'Bring ID if you have it, phone chargers, and anything you take every day. You can still go without them.',
  },
  'Register for FEMA housing assistance': {
    summary: "Signing up for FEMA help with rent, home repair or a place to stay while your home can't be lived in.",
    whereToGo: ['DisasterAssistance.gov, the FEMA App, or 1-800-621-3362', 'A FEMA Disaster Recovery Center in person'],
    tip: `Have your address, insurance details and bank info for direct deposit ready. Register even if you have insurance. If FEMA says no, read the letter: it's often a missing document, and you have 60 days to appeal. ${FEMA_DECLARED}`,
  },
  'Ask about a hotel voucher or transitional shelter': {
    summary: "A hotel room paid for directly, for a few weeks, while you can't go home.",
    whereToGo: [
      'FEMA Transitional Sheltering Assistance: check DisasterAssistance.gov after you register to see if you qualify and which hotels take part',
      'Your homeowners or renters insurance: "additional living expenses" or "loss of use" coverage often pays for a hotel',
      CALL_211,
    ],
    tip: 'Keep every receipt for hotels, meals and laundry. Insurance reimburses these.',
  },
  'Photograph the damage and file an insurance claim': {
    summary: 'Proof of what was damaged, and starting your claim so money can start moving.',
    whereToGo: [
      "Your insurer's claims line or app. Get a claim number and write it down.",
      'Your landlord, if you rent: they claim for the building, and your renters insurance covers your belongings',
      'Your state insurance department, if a claim stalls',
    ],
    tip: "Photograph and video everything before cleaning up. Standard homeowners policies don't cover flooding; flood claims go through a separate flood policy (often NFIP).",
  },
  'Apply for longer-term rental assistance': {
    summary: 'Help paying rent for months, not weeks, while you rebuild or find a new home.',
    whereToGo: [
      'FEMA rental assistance, which you can ask to have continued if you still need it',
      'Your local public housing authority',
      CALL_211,
    ],
  },

  // Stranded without transportation
  'Check which roads are open': {
    summary: 'Which roads are open, so you don\'t burn fuel on a route that\'s blocked.',
    whereToGo: [
      "511 by phone or web, available in many states",
      "Your state Department of Transportation's website or app",
      'Local emergency management alerts and news radio',
    ],
  },
  'Find a free shuttle or transit to shelters and aid centers': {
    summary: 'Free rides to shelters, Disaster Recovery Centers and distribution points.',
    whereToGo: [
      'Your local transit agency, which often runs free disaster shuttles or waives fares',
      'Shelter staff',
      CALL_211,
    ],
  },
  'Find open fuel stations and fuel vouchers': {
    summary: 'Finding stations that actually have fuel and power, and help paying for it.',
    whereToGo: [
      "GasBuddy's fuel availability tracker, which is often turned on during big disasters",
      'Relief organizations like the Salvation Army and the Red Cross, which sometimes hand out fuel cards',
      CALL_211,
    ],
  },
  'File a vehicle insurance claim and ask about a rental car': {
    summary: "Getting your car repaired or replaced, and a rental while you wait.",
    whereToGo: ["Your auto insurer's claims line or app"],
    tip: "Flood and fire damage to a car is usually covered only with comprehensive coverage, and a rental only with rental reimbursement. Check your policy. If insurance doesn't cover it and it's your only vehicle, mention it when you register with FEMA.",
  },
}

// For any need without a card: always point somewhere real.
const fallbackCard: ResourceCard = {
  summary: 'Local help for this exists in most areas, but the details depend on where you are.',
  whereToGo: [CALL_211],
}

export function getResourceInfo(needName: string): ResourceCard {
  return resourceContent[needName] ?? fallbackCard
}
