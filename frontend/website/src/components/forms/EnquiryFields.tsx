import type { UseFormRegisterReturn } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/forms/Field'

interface NamePhoneFieldsProps {
  nameId: string
  phoneId: string
  nameProps: UseFormRegisterReturn
  phoneProps: UseFormRegisterReturn
  nameError?: string
  phoneError?: string
}

/** Full name + mobile number fields shared by the enquiry forms. Render inside the caller's grid. */
export function NamePhoneFields({ nameId, phoneId, nameProps, phoneProps, nameError, phoneError }: NamePhoneFieldsProps) {
  return (
    <>
      <Field id={nameId} label="Full name" error={nameError}>
        {(aria) => <Input {...aria} {...nameProps} autoComplete="name" placeholder="Enter your name" />}
      </Field>
      <Field id={phoneId} label="Mobile number" error={phoneError}>
        {(aria) => <Input {...aria} {...phoneProps} type="tel" inputMode="tel" autoComplete="tel-national" placeholder="0000000000" />}
      </Field>
    </>
  )
}
