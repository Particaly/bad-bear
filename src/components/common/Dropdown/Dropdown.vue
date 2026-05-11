<script setup lang="ts">
import { ZSelect } from 'ztools-ui'
import type { SelectModelValue } from 'ztools-ui'
import type { DropdownEmits, DropdownProps } from './Dropdown'

withDefaults(defineProps<DropdownProps>(), {
  placeholder: '请选择'
})

const emit = defineEmits<DropdownEmits>()

function handleUpdateModelValue(value: SelectModelValue): void {
  if (!Array.isArray(value)) {
    emit('update:modelValue', value)
  }
}

function handleChange(value: SelectModelValue): void {
  if (!Array.isArray(value)) {
    emit('change', value)
  }
}
</script>

<template>
  <ZSelect
    :model-value="modelValue"
    :options="options"
    :placeholder="placeholder"
    @update:model-value="handleUpdateModelValue"
    @change="handleChange"
  />
</template>
