import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { FormSheet } from '@/components/shared/form-sheet';
import { Form } from '@/components/ui/form';
import { applyServerErrors } from '@/lib/api/errors';
import { patientsApi, type Patient } from '@redux/features/patients';
import {
  patientDefaults,
  PatientFields,
  patientFieldsSchema,
  toPatientInput,
  type PatientFieldValues,
} from './patient-fields';

interface PatientFormSheetProps {
  patient: Patient | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (patient: Patient) => void;
}

export function PatientFormSheet({ patient, open, onOpenChange, onSaved }: PatientFormSheetProps) {
  const [save, saveState] = patientsApi.useSave();
  const form = useForm<PatientFieldValues, unknown, z.output<typeof patientFieldsSchema>>({
    resolver: zodResolver(patientFieldsSchema),
    values: patientDefaults(patient),
  });

  const submit = form.handleSubmit((values) => {
    void save({ id: patient?.id, body: toPatientInput(values) })
      .unwrap()
      .then(({ data }) => {
        toast.success(patient ? 'Patient updated' : 'Patient added');
        onOpenChange(false);
        onSaved?.(data);
      })
      .catch((error) => applyServerErrors(form, error));
  });

  return (
    <Form {...form}>
      <FormSheet
        open={open}
        onOpenChange={onOpenChange}
        title={patient ? 'Edit patient' : 'New patient'}
        description="Patients are shared by all branches and found by phone number."
        onSubmit={submit}
        submitting={saveState.isLoading}
        submitLabel={patient ? 'Save changes' : 'Add patient'}
      >
        <PatientFields excludeId={patient?.id} />
      </FormSheet>
    </Form>
  );
}
