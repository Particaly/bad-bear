import type { SelectOption } from 'ztools-ui'

type DropdownValueType = string | number

export interface DropdownOption extends SelectOption {
  value: DropdownValueType
}

export interface DropdownProps {
  modelValue: string | number | null
  options: DropdownOption[]
  placeholder?: string
}

export interface DropdownEmits {
  (e: 'update:modelValue', value: DropdownValueType | null): void
  (e: 'change', value: DropdownValueType | null): void
}
