import { useParams } from 'react-router';
import { Letterhead, PrintField, PrintPage, SignatureLine } from '@/components/shared/print-document';
import { formatDate } from '@/lib/format';
import {
  NOTE_LABELS,
  usePrescriptionPrint,
  type CatalogCategory,
  type NoteKey,
  type PrescriptionPrintData,
} from './api';

const PRINT_ORDER: { title: string; categories: CatalogCategory[]; note?: NoteKey }[] = [
  { title: 'Blood work', categories: ['lab'], note: 'blood' },
  { title: 'Imaging', categories: ['imaging', 'genetic'], note: 'imaging' },
  { title: 'Supplements', categories: ['supplement', 'medicine', 'glp'], note: 'supplements' },
  { title: 'Skin care', categories: ['skin_care'], note: 'skinCare' },
  { title: 'Hair care', categories: ['hair_care'], note: 'hairCare' },
  { title: 'Treatments', categories: ['bhrt'] },
  { title: 'Symptoms', categories: ['symptom'] },
];

type Section = PrescriptionPrintData['sections'][number];
type Item = Section['groups'][number]['items'][number];

function ItemLine({ item, withInstructions }: { item: Item; withInstructions: boolean }) {
  return (
    <li className="break-inside-avoid">
      <span className="font-medium">{item.name}</span>
      {item.dose ? <span> — {item.dose}</span> : null}
      {item.optional ? <span className="text-muted-foreground"> (optional)</span> : null}
      {withInstructions && item.instructions ? (
        <p className="mt-0.5 text-xs text-muted-foreground">How to use: {item.instructions}</p>
      ) : null}
    </li>
  );
}

export function PrescriptionPrint() {
  const { id = '' } = useParams();
  const query = usePrescriptionPrint(id);

  return (
    <PrintPage isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()}>
      {() => {
        const data = query.data;
        if (!data) return null;
        const rx = data.prescription;
        const notes = (rx.notes ?? {}) as Partial<Record<NoteKey, string | null>>;
        return (
          <div className="space-y-5 text-sm">
            <Letterhead
              title="Prescription"
              subtitle={`No ${rx.prescriptionNo}`}
              organization={{
                name: data.doctor.name,
                lines: [
                  data.doctor.details,
                  data.doctor.phone ? `Phone: ${data.doctor.phone}` : null,
                  data.company?.name,
                ],
              }}
            />
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <PrintField label="Patient" value={data.patient.name} />
              <PrintField label="Date" value={formatDate(rx.date, 'dd-MM-yyyy')} />
              <PrintField label="Age" value={data.patient.age ? `${data.patient.age} years` : null} />
              <PrintField
                label="City"
                value={[data.patient.city, data.patient.country].filter(Boolean).join(', ')}
              />
            </div>
            <PrintField label="Diagnosis" value={rx.diagnosis} />

            {PRINT_ORDER.map((block) => {
              const sections = data.sections.filter((s) => block.categories.includes(s.category));
              const note = block.note ? notes[block.note] : null;
              if (sections.length === 0 && !note) return null;
              return (
                <section key={block.title} className="break-inside-avoid space-y-2">
                  <h3 className="border-b pb-1 text-sm font-semibold tracking-wide text-primary uppercase">
                    {block.title}
                  </h3>
                  {sections.flatMap((section) =>
                    section.groups.map((group) => (
                      <div key={`${section.category}-${group.groupName}`}>
                        <div className="text-xs font-medium text-muted-foreground">{group.groupName}</div>
                        <ul className="mt-1 list-disc space-y-1 pl-5">
                          {group.items.map((item) => (
                            <ItemLine
                              key={item.id}
                              item={item}
                              withInstructions={block.categories.includes('bhrt')}
                            />
                          ))}
                        </ul>
                      </div>
                    )),
                  )}
                  {note ? (
                    <p>
                      <span className="text-muted-foreground">
                        {block.note ? NOTE_LABELS[block.note] : 'Note'}:
                      </span>{' '}
                      {note}
                    </p>
                  ) : null}
                </section>
              );
            })}

            {rx.planTreatment ? (
              <section className="break-inside-avoid space-y-2">
                <h3 className="border-b pb-1 text-sm font-semibold tracking-wide text-primary uppercase">
                  Plan of treatment
                </h3>
                <p className="whitespace-pre-wrap">{rx.planTreatment}</p>
              </section>
            ) : null}

            <div className="flex items-end justify-between gap-6 pt-8">
              <PrintField
                label="Follow up date"
                value={rx.followupDate ? formatDate(rx.followupDate, 'dd-MM-yyyy') : null}
                className="w-64"
              />
              <SignatureLine label={data.doctor.name} imageUrl={data.doctor.signatureUrl} />
            </div>
          </div>
        );
      }}
    </PrintPage>
  );
}
