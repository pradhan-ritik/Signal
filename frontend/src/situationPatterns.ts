// The known post-disaster situations Signal can recognize.
// Each pattern is a "constellation": its triggers are the stars, and the
// needs are the steps someone in that situation usually has to take, in order.
// Each one is worded as an action, because the app's output is a to-do process.
// Needs are logistics only: where to go and what to bring. Never medical or emergency advice.

export type Trigger = {
  label: string // what this trigger means, in plain words
  keywords: string[] // words or phrases that tell us the trigger applies
}

export type SituationPattern = {
  name: string
  triggers: Trigger[]
  needs: string[] // ordered: first thing first
}

export const situationPatterns: SituationPattern[] = [
  {
    name: 'Evacuee with dependents',
    triggers: [
      { label: 'Children are with you', keywords: ['kid', 'child', 'children', 'son', 'daughter', 'baby', 'babies', 'toddler', 'infant', 'teenager'] },
      { label: 'School or childcare is disrupted', keywords: ['school', 'daycare', 'childcare', 'classes'] },
      { label: "Children's supplies are missing", keywords: ['diaper', 'formula', 'stroller', 'car seat', 'crib'] },
    ],
    needs: [
      'Find a shelter with space for families',
      "Pick up diapers, formula and other children's supplies",
      "Check your school's status and how to re-enroll",
      'Arrange free or emergency childcare',
    ],
  },
  {
    name: 'Needs replacement documents',
    triggers: [
      { label: 'Photo ID is lost', keywords: ['id', 'license', 'passport', 'identification'] },
      { label: 'Vital records are lost', keywords: ['birth certificate', 'social security card', 'documents', 'paperwork', 'papers'] },
      { label: 'Bank or insurance papers are lost', keywords: ['insurance policy', 'insurance papers', 'deed', 'debit card', 'credit card', 'bank card', 'checkbook'] },
    ],
    needs: [
      'Write down every document that is missing',
      "Replace your driver's license or state ID",
      'Order a replacement birth certificate',
      'Request a replacement Social Security card',
      'Ask your bank and insurer for new cards and policy copies',
    ],
  },
  {
    name: 'Pet owner evacuee',
    triggers: [
      { label: 'A pet is with you', keywords: ['pet', 'dog', 'cat', 'puppy', 'puppies', 'kitten', 'bird', 'rabbit'] },
      { label: 'Pet supplies are missing', keywords: ['pet food', 'dog food', 'cat food', 'leash', 'crate', 'carrier', 'litter'] },
      { label: 'Pet records are missing', keywords: ['vaccination', 'vaccine records', 'vet records', 'microchip', 'tag'] },
    ],
    needs: [
      'Find a pet-friendly shelter or emergency boarding',
      'Pick up pet food, a leash and a carrier',
      "Get copies of your pet's vaccination records",
      "Update the contact details on your pet's tag or microchip",
      'Look for pet-friendly housing for the weeks ahead',
    ],
  },
  {
    name: 'Elderly or mobility-limited evacuee',
    triggers: [
      { label: 'An older adult is involved', keywords: ['elderly', 'senior', 'grandmother', 'grandfather', 'grandma', 'grandpa', 'grandparent'] },
      { label: 'Mobility equipment is used or lost', keywords: ['wheelchair', 'walker', 'cane', 'mobility', 'scooter'] },
      { label: 'Access or daily assistance is needed', keywords: ['stairs', 'accessible', 'caregiver', 'disabled', 'disability', "can't walk", 'cannot walk'] },
      { label: 'Cannot drive', keywords: ["can't drive", 'cannot drive', "doesn't drive", 'no ride'] },
    ],
    needs: [
      'Ask for an accessible shelter space',
      'Book accessible transportation',
      'Borrow or replace mobility equipment',
      'Get a case manager through your Area Agency on Aging',
      'Update the mailing address for benefit payments',
    ],
  },
  {
    name: 'Financial hardship',
    triggers: [
      { label: 'No cash on hand', keywords: ['cash', 'money', "i'm broke", 'i am broke', "we're broke", 'we are broke', "can't afford", 'cannot afford'] },
      { label: 'No access to your bank', keywords: ['bank', 'atm', 'wallet', 'debit card', 'credit card'] },
      { label: 'Income has stopped', keywords: ['job', 'paycheck', 'unemployed', 'laid off', 'out of work', 'income'] },
      { label: 'Basics are hard to pay for', keywords: ['gas', 'food', 'groceries', 'bills', 'pay rent', 'my rent', 'the rent', 'on rent'] },
    ],
    needs: [
      'Get free meals and groceries',
      'Apply for FEMA disaster assistance',
      'Apply for disaster food benefits (D-SNAP)',
      'File for Disaster Unemployment Assistance',
      'Ask your bank, landlord and lenders to pause payments',
    ],
  },
  {
    name: 'Needs temporary housing',
    triggers: [
      { label: 'You had to leave home', keywords: ['evacuated', 'evacuate', 'evacuating', 'evacuation', 'displaced', 'left home', 'had to leave'] },
      { label: 'Your home is damaged', keywords: ['lost my home', 'lost our home', 'destroyed', 'damaged', 'flooded', 'burned', 'burnt', 'unlivable', 'condemned', 'collapsed'] },
      { label: 'No stable place to stay', keywords: ['nowhere to stay', 'no place to stay', 'sleeping in my car', 'shelter', 'hotel', 'motel', 'couch'] },
      { label: 'You rent or own the home', keywords: ['landlord', 'lease', 'mortgage', 'renter', 'homeowner'] },
    ],
    needs: [
      'Find an open shelter for tonight',
      'Register for FEMA housing assistance',
      'Ask about a hotel voucher or transitional shelter',
      'Photograph the damage and file an insurance claim',
      'Apply for longer-term rental assistance',
    ],
  },
  {
    name: 'Stranded without transportation',
    triggers: [
      { label: 'Fuel is running out', keywords: ['low on gas', 'out of gas', 'no gas', 'gas', 'fuel'] },
      { label: 'Your vehicle is unusable or gone', keywords: ['no car', 'lost my car', 'car flooded', 'broke down', 'flat tire', 'totaled'] },
      { label: 'You need to get somewhere', keywords: ['stranded', 'no ride', 'bus', 'far from', 'miles away'] },
    ],
    needs: [
      'Check which roads are open',
      'Find a free shuttle or transit to shelters and aid centers',
      'Find open fuel stations and fuel vouchers',
      'File a vehicle insurance claim and ask about a rental car',
    ],
  },
]
