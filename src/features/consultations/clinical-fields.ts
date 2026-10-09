import type { SectionKey } from './api';

export type FormValues = Record<string, unknown>;
type Condition = (values: FormValues) => boolean;
export type Choice = readonly [value: string, label: string];

interface Base {
  key: string;
  label: string;
  when?: Condition;
  required?: boolean;
  description?: string;
  wide?: boolean;
}

export type FieldDef =
  | (Base & { kind: 'text' | 'date' | 'textarea' })
  | (Base & { kind: 'number'; integer?: boolean })
  | (Base & { kind: 'yesNo' })
  | (Base & { kind: 'choice'; options: readonly Choice[] })
  | (Base & { kind: 'bool' })
  | (Base & { kind: 'checks'; groups: { title?: string; options: readonly Choice[] }[] })
  | (Base & { kind: 'mrs' })
  | (Base & { kind: 'scan'; extraKey?: string; extraLabel?: string })
  | (Base & { kind: 'surgeries'; options: readonly Choice[] })
  | { kind: 'heading'; key: string; label: string; description?: string; when?: Condition }
  | { kind: 'bmi'; key: string; label: string; when?: Condition };

export interface SectionDef {
  key: SectionKey;
  title: string;
  description?: string;
  fields: FieldDef[];
}

const choices = (...items: string[]): Choice[] =>
  items.map((item) => {
    const [value = '', label = value] = item.split(':');
    return [value, label] as const;
  });

const is = (key: string, value: string) => (v: FormValues) => v[key] === value;
const YES_NO_OCCASIONAL = choices('yes:Yes', 'no:No', 'occasionally:Occasionally');

const yesNo = (key: string, label: string, extra: Partial<Base> = {}): FieldDef => ({
  kind: 'yesNo',
  key,
  label,
  wide: true,
  ...extra,
});
const heading = (key: string, label: string, description?: string): FieldDef => ({
  kind: 'heading',
  key,
  label,
  description,
});

export const SECTIONS: Record<SectionKey, SectionDef> = {
  basic_info: {
    key: 'basic_info',
    title: 'Basic information',
    description: 'Name, age, city and country update the patient record for every branch.',
    fields: [
      { kind: 'text', key: 'name', label: 'Name', required: true },
      { kind: 'number', key: 'age', label: 'Age', required: true, integer: true },
      { kind: 'text', key: 'city', label: 'City', required: true },
      { kind: 'text', key: 'country', label: 'Country', required: true },
      { kind: 'number', key: 'weightKg', label: 'Weight in KGs', required: true },
      {
        kind: 'number',
        key: 'heightFeet',
        label: 'Height in feet',
        required: true,
        description: 'Type 54 for 5.4 ft; the point is added for you',
      },
      { kind: 'bmi', key: 'bmi', label: 'BMI' },
      { kind: 'text', key: 'waistCircumference', label: 'Waist circumference' },
      {
        kind: 'choice',
        key: 'maritalStatus',
        label: 'Marital status',
        required: true,
        options: choices('single:Single', 'married:Married', 'divorced:Divorced', 'widowed:Widowed'),
        wide: true,
      },
      {
        kind: 'text',
        key: 'marriedYears',
        label: 'For how many years?',
        required: true,
        when: (v) => Boolean(v.maritalStatus) && v.maritalStatus !== 'single',
      },
      yesNo('hasKids', 'Kids', {
        required: true,
        wide: false,
        when: (v) => Boolean(v.maritalStatus) && v.maritalStatus !== 'single',
      }),
      {
        kind: 'text',
        key: 'kidsDetails',
        label: 'How many children?',
        required: true,
        when: (v) => v.maritalStatus !== 'single' && v.hasKids === 'yes',
      },
      { kind: 'text', key: 'education', label: 'Education' },
      { kind: 'text', key: 'occupation', label: 'Occupation' },
    ],
  },
  follow_up: {
    key: 'follow_up',
    title: 'Follow up form',
    description: 'Shown for follow up visits.',
    fields: [
      {
        kind: 'choice',
        key: 'pgic',
        label: 'PGIC: since starting treatment, how would you describe the change in your overall condition?',
        wide: true,
        options: choices(
          'very_much_improved:Very much improved',
          'much_improved:Much improved',
          'minimally_improved:Minimally improved',
          'no_change:No change',
          'minimally_worse:Minimally worse',
          'much_worse:Much worse',
          'very_much_worse:Very much worse',
        ),
      },
      {
        kind: 'textarea',
        key: 'discussTopics',
        label: 'What are the top 3 things you would like to discuss in your consultation?',
        wide: true,
      },
      { kind: 'textarea', key: 'majorComplaint', label: 'Major complaint', wide: true },
      { kind: 'textarea', key: 'currentMedications', label: 'Current medications', wide: true },
      {
        kind: 'textarea',
        key: 'beforeVisitNote',
        label: "Anything else you would like your doctor to know before today's visit?",
        wide: true,
      },
      heading('h-health', 'About your health'),
      yesNo('usingHormoneTherapy', 'Are you currently using hormone therapy?'),
      {
        kind: 'choice',
        key: 'hormoneTherapySinceLastVisit',
        label: 'Since your last visit, has your hormone therapy been?',
        wide: true,
        options: choices('continuous:Continuous', 'interrupted:Interrupted', 'stopped:Stopped'),
      },
      {
        kind: 'textarea',
        key: 'interruptionReason',
        label: 'Reason for interruption',
        required: true,
        wide: true,
        when: is('hormoneTherapySinceLastVisit', 'interrupted'),
      },
      yesNo('stillHavingPeriods', 'Are you still having periods?'),
      yesNo('spottingAfterHrt', 'Did you experience any spotting/bleeding after starting HRT?'),
      heading('h-medical', 'Medical history'),
      yesNo('medicalHistoryChanged', 'Any changes to your medical history since your last appointment?'),
      heading('h-medication', 'Medication history'),
      yesNo('newMedications', 'Started any new medications since your last consultation at DSM?'),
      yesNo(
        'reducedMedications',
        'Reduced the dose or frequency of any medications since starting hormone treatment?',
      ),
      yesNo('stoppedMedications', 'Stopped taking any medications since starting hormone treatment?'),
      {
        kind: 'choice',
        key: 'improvementCause',
        label:
          'If your symptoms improved and you reduced or stopped medications, was this due to hormone treatment?',
        wide: true,
        options: choices(
          'hormone_treatment:Hormone treatment',
          'new_medication:New medication',
          'not_sure_both:Not sure / both',
          'not_applicable:Not applicable',
          'other:Other',
        ),
      },
      yesNo('utiAntibiotics', 'Needed antibiotics for a UTI since your last consultation?'),
      heading('h-adverse', 'Adverse events'),
      yesNo(
        'adverseEvent',
        'Any new or unexpected adverse event or significant medical problem while on hormone therapy?',
      ),
      {
        kind: 'textarea',
        key: 'adverseEventDetails',
        label: 'If yes, please specify',
        required: true,
        wide: true,
        when: is('adverseEvent', 'yes'),
      },
      {
        kind: 'textarea',
        key: 'adverseEventOther',
        label: 'Other adverse events',
        description:
          'Bleeding, DVT/VTE/PE, stroke/TIA, cardiovascular event, breast or endometrial disease, other cancer, hospitalization…',
        wide: true,
      },
      heading('h-screening', 'Screening'),
      yesNo('cervicalScreeningUpToDate', 'Up to date with your cervical screening?'),
      yesNo('breastScreeningUpToDate', 'Up to date with your breast screening?'),
      yesNo('dexaSinceLastVisit', 'Had a DEXA scan since your last appointment?'),
      yesNo('bloodPressureChecked', 'Blood pressure checked in the last 12 months?'),
    ],
  },
  medical_history: {
    key: 'medical_history',
    title: 'Medical history',
    fields: [
      heading('h-topics', 'Consultation topics'),
      {
        kind: 'textarea',
        key: 'discussTopics',
        label: 'What are the top 3 things you would like to discuss in your consultation?',
        wide: true,
      },
      { kind: 'textarea', key: 'majorComplaint', label: 'Major complaint', wide: true },
      heading('h-hormones', 'Hormones, contraception and periods'),
      {
        kind: 'choice',
        key: 'hormoneTherapy',
        label: 'Have you ever used hormone therapy?',
        wide: true,
        options: choices('never:Never', 'currently_using:Currently using', 'previously_used:Previously used'),
      },
      { kind: 'textarea', key: 'hormonesUsed', label: 'Which hormones have you used?', wide: true },
      {
        kind: 'choice',
        key: 'contraception',
        label: 'Are you using any form of contraception?',
        wide: true,
        options: choices('yes:Yes', 'no:No', 'not_needed:Not needed'),
      },
      yesNo('havingPeriods', 'Are you still having periods?'),
      {
        kind: 'date',
        key: 'lastPeriodDate',
        label: 'Last menstrual period date',
        required: true,
        when: is('havingPeriods', 'yes'),
      },
      {
        kind: 'choice',
        key: 'cycle',
        label: 'Cycle',
        required: true,
        options: choices('regular:Regular', 'irregular:Irregular'),
        when: is('havingPeriods', 'yes'),
      },
      {
        kind: 'choice',
        key: 'flow',
        label: 'Periods flow',
        options: choices('normal:Normal', 'heavy:Heavy', 'low:Low'),
        when: (v) => v.havingPeriods === 'yes' && Boolean(v.cycle),
      },
      {
        kind: 'bool',
        key: 'dub',
        label: 'DUB (Dysfunctional Uterine Bleed)',
        when: is('cycle', 'irregular'),
      },
      {
        kind: 'bool',
        key: 'oligomenorrhea',
        label: 'Oligomenorrhea (Infrequent)',
        when: is('cycle', 'irregular'),
      },
      {
        kind: 'textarea',
        key: 'periodsNote',
        label: 'Periods note',
        wide: true,
        when: is('havingPeriods', 'no'),
      },
      yesNo('menopauseDiagnosed', 'Have you been diagnosed with menopause?'),
      { kind: 'text', key: 'menopauseDiagnosedAge', label: 'Age at which menopause was diagnosed' },
      {
        kind: 'checks',
        key: 'conditions',
        label: 'Have you ever had any of the following medical conditions?',
        wide: true,
        groups: [
          {
            title: 'Cancer',
            options: choices(
              'breast_cancer:Breast Cancer',
              'endometrial_cancer:Endometrial Cancer',
              'ovarian_cancer:Ovarian Cancer',
              'brca:BRCA 1 / BRCA 2',
              'lynch_syndrome:Lynch Syndrome',
              'other_cancer:Any Other Cancer',
            ),
          },
          {
            title: 'Hormonal',
            options: choices(
              'hyperthyroidism:Hyperthyroidism',
              'hypothyroidism:Hypothyroidism',
              'endometriosis:Endometriosis',
              'pms:Premenstrual Syndrome (PMS)',
              'pcos:Polycystic Ovary Syndrome (PCOS)',
            ),
          },
          {
            title: 'Metabolic',
            options: choices(
              'diabetes:Diabetes',
              'insulin_resistance:Insulin Resistance',
              'dyslipidemia:Dyslipidemia',
              'nafld:NAFLD',
            ),
          },
          {
            title: 'Musculoskeletal',
            options: choices(
              'osteopenia:Osteopenia',
              'osteoporosis:Osteoporosis',
              'osteoarthritis:Osteoarthritis',
              'rheumatoid_arthritis:Rheumatoid Arthritis',
              'gout:Gout',
            ),
          },
          {
            title: 'Cardiac',
            options: choices(
              'heart_disease:Heart Disease',
              'hypertension:Hypertension',
              'dvt:Deep Vein Thrombosis (DVT)',
              'pulmonary_embolism:Pulmonary Embolism',
              'tia:TIA',
            ),
          },
          {
            title: 'Mental',
            options: choices(
              'anxiety:Anxiety',
              'depression:Depression',
              'chronic_fatigue_me:Chronic Fatigue/ME (+Fibromyalgia)',
              'pnd:Post-natal Depression (PND)',
              'pmdd:Premenstrual Dysphoric Disorder (PMDD)',
            ),
          },
          {
            title: 'Neurological',
            options: choices(
              'migraine:Migraine or Severe Headaches',
              'epilepsy:Epilepsy',
              'multiple_sclerosis:Multiple Sclerosis',
              'memory_issues:Memory Issues',
              'stroke:Stroke',
            ),
          },
          { title: 'Autoimmune', options: choices('lupus_sle:Lupus / SLE', 'skin_disease:Any Skin Disease') },
          {
            title: 'Liver / GI',
            options: choices(
              'liver_disease:Liver Disease',
              'chronic_reflux:Chronic Reflux',
              'celiac_disease:Celiac Disease',
              'ibs:IBS',
              'h_pylori:H - Pylori',
            ),
          },
          {
            title: 'Genitourinary',
            options: choices(
              'recurrent_uti:Recurrent UTI',
              'vaginal_infections:Vaginal Infections',
              'std:STD',
            ),
          },
        ],
      },
      { kind: 'textarea', key: 'otherConditions', label: 'Any other', wide: true },
      {
        kind: 'surgeries',
        key: 'surgeries',
        label: 'Surgical history',
        wide: true,
        options: choices(
          'hysterectomy:Hysterectomy',
          'ovaries_removed:Ovaries Removed',
          'c_section:C-Section',
          'tubal_ligation:Tubal Ligation',
          'myomectomy:Myomectomy',
          'endometriosis_surgery:Endometriosis Surgery',
          'breast_surgery:Breast Surgery',
          'bariatric_surgery:Bariatric Surgery',
          'other:Other',
        ),
      },
      {
        kind: 'text',
        key: 'otherSurgery',
        label: 'Other surgery',
        wide: true,
        when: (v) =>
          Array.isArray(v.surgeries) && v.surgeries.some((s) => (s as { type: string }).type === 'other'),
      },
      heading(
        'h-family',
        'Family history',
        'Has your mother, father, sister, or another close family member ever been diagnosed with any of the following conditions?',
      ),
      {
        kind: 'checks',
        key: 'familyRelatives',
        label: 'Relatives',
        wide: true,
        groups: [
          {
            options: choices(
              'mother:Mother',
              'father:Father',
              'sister:Sister',
              'close_family:Any Close Family Member',
            ),
          },
        ],
      },
      {
        kind: 'checks',
        key: 'familyConditions',
        label: 'Conditions',
        wide: true,
        groups: [
          {
            options: choices(
              'breast_cancer:Breast Cancer',
              'ovarian_cancer:Ovarian Cancer',
              'endometrial_cancer:Endometrial Cancer',
              'osteoporosis:Osteoporosis',
              'hip_fracture:Hip Fracture',
              'heart_disease:Heart Disease',
              'diabetes:Diabetes',
              'early_menopause:Early Menopause',
              'dementia:Dementia',
              'other:Other',
            ),
          },
        ],
      },
      { kind: 'text', key: 'familyOther', label: 'Other family history', wide: true },
      heading('h-medications', 'Medications, allergies and lifestyle'),
      { kind: 'textarea', key: 'currentMedications', label: 'Current medications', wide: true },
      yesNo('utiAntibiotics12m', 'Needed antibiotics for a UTI in the last 12 months?'),
      yesNo(
        'painMedication',
        'Taking medication for pain, nerve pain or migraines (paracetamol, ibuprofen, tramadol, gabapentin, amitriptyline)?',
      ),
      yesNo(
        'moodMedication',
        'Taking or ever prescribed medication for mood, anxiety, depression or other mental health conditions?',
      ),
      yesNo(
        'sleepMedication',
        'Taking medications or supplements for sleep (zopiclone, zolpidem, melatonin, magnesium, antihistamines)?',
      ),
      yesNo(
        'weightLossMedication',
        'Taking weight-loss medication (semaglutide/Wegovy, tirzepatide/Mounjaro)?',
      ),
      yesNo('hasAllergies', 'Any allergies to medications, foods or other substances?'),
      {
        kind: 'textarea',
        key: 'allergies',
        label: 'Allergy details',
        required: true,
        wide: true,
        when: is('hasAllergies', 'yes'),
      },
      { kind: 'choice', key: 'alcohol', label: 'Do you take alcohol?', options: YES_NO_OCCASIONAL },
      { kind: 'choice', key: 'smoking', label: 'Do you smoke?', options: YES_NO_OCCASIONAL },
      { kind: 'choice', key: 'exercise', label: 'Do you exercise regularly?', options: YES_NO_OCCASIONAL },
      yesNo('followsDiet', 'Are you following a specific diet plan?', { wide: false }),
      { kind: 'text', key: 'dietName', label: 'Diet name', required: true, when: is('followsDiet', 'yes') },
      {
        kind: 'checks',
        key: 'relationship',
        label: 'Relationship status',
        wide: true,
        groups: [{ options: choices('abusive:Abusive', 'conflicted:Conflicted', 'healthy:Healthy') }],
      },
      {
        kind: 'textarea',
        key: 'relationshipSituation',
        label: 'What is your current relationship situation?',
        wide: true,
      },
    ],
  },
  mrs_scale: {
    key: 'mrs_scale',
    title: 'MRS scale',
    description: 'Menopause Rating Scale. 0 None · 1 Mild · 2 Moderate · 3 Severe · 4 Very severe.',
    fields: [
      { kind: 'date', key: 'date', label: 'Date', required: true },
      heading('h-somatic', 'Somatic'),
      { kind: 'mrs', key: 'hotFlushes', label: 'Hot flushes, sweating, episodes of heat' },
      {
        kind: 'mrs',
        key: 'heartDiscomfort',
        label: 'Heart discomfort (palpitations, awareness of heartbeat, chest tightness)',
      },
      {
        kind: 'mrs',
        key: 'sleepProblems',
        label: 'Sleep problems (difficulty falling asleep, waking early, disturbed sleep)',
      },
      {
        kind: 'mrs',
        key: 'jointMuscleDiscomfort',
        label: 'Joint and muscle discomfort (pain, stiffness, aches)',
      },
      heading('h-psychological', 'Psychological'),
      { kind: 'mrs', key: 'depressiveMood', label: 'Depressive mood (low mood, crying, hopelessness)' },
      { kind: 'mrs', key: 'irritability', label: 'Irritability' },
      { kind: 'mrs', key: 'anxiety', label: 'Anxiety (inner tension, panic, nervousness)' },
      {
        kind: 'mrs',
        key: 'exhaustion',
        label: 'Physical and mental exhaustion (fatigue, poor concentration, memory problems)',
      },
      heading('h-urogenital', 'Urogenital'),
      {
        kind: 'mrs',
        key: 'sexualProblems',
        label: 'Sexual problems (reduced desire, satisfaction, discomfort during intercourse)',
      },
      {
        kind: 'mrs',
        key: 'bladderProblems',
        label: 'Bladder problems (urgency, frequency, urinary leakage)',
      },
      { kind: 'mrs', key: 'vaginalDryness', label: 'Vaginal dryness (dryness, burning, discomfort)' },
    ],
  },
  additional_symptoms: {
    key: 'additional_symptoms',
    title: 'Additional symptoms',
    fields: [
      {
        kind: 'checks',
        key: 'symptoms',
        label: 'Symptoms',
        wide: true,
        groups: [
          {
            title: 'Hair / skin / nails',
            options: choices(
              'hair_loss:Hair Loss',
              'increased_facial_hair:Increased Facial Hair',
              'skin_issues:Skin Issues',
              'dry_skin:Dry Skin',
              'skin_itching:Skin Itching',
              'crawling_sensation:Crawling Sensation',
              'nail_changes:Nail Changes',
              'body_odor_change:Change in Body Odor',
            ),
          },
          {
            title: 'Weight / metabolic',
            options: choices(
              'weight_gain:Weight Gain',
              'weight_loss:Weight Loss',
              'belly_fat:Belly Fat',
              'food_sugar_cravings:Food or Sugar Cravings',
            ),
          },
          {
            title: 'Musculoskeletal / physical',
            options: choices(
              'decreased_strength:Decreased Physical Strength',
              'decreased_stamina:Decreased Stamina',
              'low_backache:Low Backache',
              'frozen_shoulder:Frozen Shoulder',
              'heel_pain:Heel Pain',
              'clicking_jaw_tmj:Clicking Jaw / TMJ Symptoms',
            ),
          },
          {
            title: 'Neurological / sensory',
            options: choices(
              'brain_fog:Brain Fog / Memory Issues',
              'headaches:Headaches',
              'migraines:Migraines',
              'dizziness_vertigo:Dizziness / Vertigo',
              'tinnitus:Ear Ringing / Tinnitus',
              'burning_soles:Burning Soles / Feet',
              'taste_changes:Taste Changes',
              'increased_smell:Increased Sense of Smell',
              'hearing_changes:Hearing Changes',
            ),
          },
          {
            title: 'Eyes',
            options: choices('dry_eyes:Dry Eyes', 'vision_changes:Eyesight / Vision Changes'),
          },
          {
            title: 'Gastrointestinal',
            options: choices(
              'bloating:Bloating',
              'gas:Gas / Gas Pains',
              'constipation:Constipation',
              'diarrhea:Diarrhea',
              'heartburn:Heart Burn',
            ),
          },
          {
            title: 'Urinary / genital',
            options: choices(
              'recurrent_utis:Recurrent UTIs',
              'stress_incontinence:Stress Urinary Incontinence (leaking with coughing/laughing)',
              'vaginal_itching:Vaginal Itching',
            ),
          },
          {
            title: 'Behavioral / social',
            options: choices(
              'social_withdrawal:Wanting to Be Alone / Social Withdrawal',
              'accomplishing_less:Accomplishing Less Than Previously',
            ),
          },
          {
            title: 'Relationship / intimacy',
            options: choices(
              'marital_conflicts:Marital Conflicts',
              'avoiding_intimacy:Avoiding Intimacy',
              'personal_life_dissatisfaction:Dissatisfaction With Personal Life',
            ),
          },
          { title: 'Voice', options: choices('voice_changes:Voice Changes') },
        ],
      },
      { kind: 'textarea', key: 'other', label: 'Other symptoms', wide: true },
    ],
  },
  imaging_results: {
    key: 'imaging_results',
    title: 'Imaging results',
    fields: [
      {
        kind: 'scan',
        key: 'pelvicScan',
        label: 'Pelvic scan',
        extraKey: 'pelvicScanDaysAfterPeriod',
        extraLabel: 'How many days after your period was the pelvic scan performed?',
        wide: true,
      },
      { kind: 'scan', key: 'dexaScan', label: 'DEXA scan', wide: true },
      { kind: 'scan', key: 'mammogram', label: 'Mammogram', wide: true },
      { kind: 'scan', key: 'breastUltrasound', label: 'Breast ultrasound', wide: true },
    ],
  },
  clinical_assessment: {
    key: 'clinical_assessment',
    title: 'Clinical assessment',
    fields: [
      {
        kind: 'checks',
        key: 'menopauseStage',
        label: 'Menopause stage',
        wide: true,
        groups: [
          {
            options: choices(
              'perimenopause:Perimenopause',
              'early_menopause:Early menopause (40–44 years)',
              'menopause:Menopause at typical age (45–55 years)',
              'late_menopause:Late menopause (after age 55)',
              'postmenopause:Postmenopause',
            ),
          },
        ],
      },
      {
        kind: 'checks',
        key: 'menopauseType',
        label: 'Type',
        wide: true,
        groups: [
          {
            options: choices(
              'natural:Natural menopause',
              'surgical:Surgical menopause',
              'induced:Induced menopause',
              'poi:Premature ovarian insufficiency (POI, before age 40)',
            ),
          },
        ],
      },
      {
        kind: 'checks',
        key: 'diagnoses',
        label: 'Other clinical diagnoses',
        wide: true,
        groups: [
          {
            options: choices(
              'osteopenia:Osteopenia',
              'osteoporosis:Osteoporosis',
              'pcos:PCOS',
              'pms_pmdd:PMS/PMDD',
              'endometriosis:Endometriosis',
              'adenomyosis:Adenomyosis',
              'ovarian_cyst:Ovarian Cyst',
            ),
          },
        ],
      },
      {
        kind: 'checks',
        key: 'complaints',
        label: 'Complaints',
        wide: true,
        groups: [
          {
            options: choices(
              'vasomotor:Vasomotor symptoms',
              'gsm:Genitourinary syndrome of menopause (GSM)',
              'hsdd:HSDD',
              'mood:Mood symptoms',
              'sleep_disorder:Sleep disorder',
              'cognitive:Cognitive symptoms',
              'weight_metabolic:Weight gain / Metabolic syndrome',
              'hair_loss:Hair loss',
              'acne:Acne',
              'other:Other',
            ),
          },
        ],
      },
      {
        kind: 'checks',
        key: 'clinicalStatus',
        label: 'Clinical status',
        wide: true,
        groups: [
          {
            options: choices(
              'improved:Improved',
              'stable:Stable',
              'worsened:Worsened',
              'no_change:No change',
            ),
          },
        ],
      },
      {
        kind: 'checks',
        key: 'treatmentPlan',
        label: 'Treatment plan',
        wide: true,
        groups: [
          {
            options: choices(
              'start_bhrt:Start BHRT',
              'continue_bhrt:Continue BHRT',
              'stop_therapy:Stop therapy',
              'change_formulation:Change formulation',
              'labs_ordered:Labs ordered',
              'imaging_ordered:Imaging ordered',
              'lifestyle_counseling:Lifestyle counseling',
              'referred_to_specialist:Referred to specialist',
            ),
          },
        ],
      },
      { kind: 'textarea', key: 'plan', label: 'Plan', wide: true },
    ],
  },
  referral: {
    key: 'referral',
    title: 'Referred to specialist',
    description: 'Prints as the DSM referral form.',
    fields: [
      { kind: 'text', key: 'referredTo', label: 'Referred to', required: true },
      { kind: 'text', key: 'specialty', label: 'Specialty', required: true },
      { kind: 'text', key: 'name', label: 'Patient name', required: true },
      { kind: 'date', key: 'dateOfBirth', label: 'Date of birth', required: true },
      { kind: 'date', key: 'date', label: 'Date', required: true },
      { kind: 'text', key: 'referringDoctorName', label: 'Referring doctor name', required: true },
      { kind: 'text', key: 'referringDoctorPhone', label: 'Referring doctor number', required: true },
      {
        kind: 'text',
        key: 'referringDoctorAddress',
        label: 'Referring doctor address',
        required: true,
        wide: true,
      },
      { kind: 'textarea', key: 'reason', label: 'Reason for referral', required: true, wide: true },
    ],
  },
  plans: {
    key: 'plans',
    title: 'Educational resources',
    fields: [
      yesNo('glpDietPlan', 'GLP diet plan?'),
      yesNo('generalDietPlan', 'General diet plan?'),
      yesNo('liverDetox', 'Liver detox?'),
      yesNo('skinCareRoutine', 'Skin care routine?'),
      yesNo('hairCareRoutine', 'Hair care routine?'),
    ],
  },
};

export const MRS_SCORES = ['0', '1', '2', '3', '4'] as const;
export const MRS_LABELS = ['None', 'Mild', 'Moderate', 'Severe', 'Very severe'];
export const SCAN_STATUSES = choices('normal:Normal', 'abnormal:Abnormal', 'not_done:Not done');
