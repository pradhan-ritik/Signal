// National help lines. Every number below was checked against the page in `source`
// on 2026-10-10. Nothing in this file is written or changed while the app runs.

export type HelpLine = {
  name: string
  contact: string // what the button says
  href: string // tel: or sms: link
  about: string
  source: string // the official page the number was checked against
}

export const HELP_LINES = {
  emergency: {
    name: '911',
    contact: 'Call 911',
    href: 'tel:911',
    about: 'Police, fire or ambulance, for danger right now.',
    source: 'https://www.911.gov/',
  },
  lifeline988: {
    name: '988 Suicide & Crisis Lifeline',
    contact: 'Call or text 988',
    href: 'tel:988',
    about: 'Free, confidential support at any hour.',
    source: 'https://988lifeline.org/',
  },
  crisisText: {
    name: 'Crisis Text Line',
    contact: 'Text HOME to 741741',
    href: 'sms:741741?&body=HOME',
    about: 'Text with a trained crisis counselor, at any hour.',
    source: 'https://www.crisistextline.org/',
  },
  local211: {
    name: '211',
    contact: 'Call 211',
    href: 'tel:211',
    about: 'Free, confidential referrals to local food, housing and other help.',
    source: 'https://www.211.org/',
  },
  disasterDistress: {
    name: 'Disaster Distress Helpline',
    contact: 'Call or text 1-800-985-5990',
    href: 'tel:18009855990',
    about: 'Counseling for anyone struggling after a disaster.',
    source: 'https://www.redcross.org/get-help/disaster-relief-and-recovery-services/recovering-emotionally.html',
  },
  fema: {
    name: 'FEMA Helpline',
    contact: 'Call 1-800-621-3362',
    href: 'tel:18006213362',
    about: 'Apply for federal disaster assistance or check an application.',
    source: 'https://www.disasterassistance.gov/',
  },
  redCross: {
    name: 'American Red Cross',
    contact: 'Call 1-800-733-2767',
    href: 'tel:18007332767',
    about: 'Open shelters, meals and emergency supplies.',
    source: 'https://www.redcross.org/contact-us.html',
  },
  socialSecurity: {
    name: 'Social Security Administration',
    contact: 'Call 1-800-772-1213',
    href: 'tel:18007721213',
    about: 'Replacement cards and benefit payments.',
    source: 'https://www.usa.gov/agencies/social-security-administration',
  },
  eldercare: {
    name: 'Eldercare Locator',
    contact: 'Call 1-800-677-1116',
    href: 'tel:18006771116',
    about: 'Finds local services for older adults.',
    source: 'https://eldercare.acl.gov/',
  },
  domesticViolence: {
    name: 'National Domestic Violence Hotline',
    contact: 'Call 1-800-799-7233',
    href: 'tel:18007997233',
    about: 'Confidential support and safety planning.',
    source: 'https://www.thehotline.org/',
  },
  samhsa: {
    name: 'SAMHSA National Helpline',
    contact: 'Call 1-800-662-4357',
    href: 'tel:18006624357',
    about: 'Treatment referrals for mental health and substance use.',
    source: 'https://www.usa.gov/substance-abuse',
  },
} satisfies Record<string, HelpLine>

export type HelpLineKey = keyof typeof HELP_LINES
