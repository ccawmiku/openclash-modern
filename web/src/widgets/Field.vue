<script setup>
import { computed, defineAsyncComponent, ref } from 'vue'
import { request, preview } from '../api.js'
import { customTemplates } from '../widget-registry.js'
import { isCommand,isReadOnlyStatus } from '../settings-structure.js'
import { fieldHelp, displayLabel,recordValue } from '../field-help.js'
const CustomWidget = defineAsyncComponent(() => import('./CustomWidget.vue'))
const props = defineProps(['field', 'modelValue', 'values', 'model', 'section', 'fields', 'context', 'error'])
const emit = defineEmits(['update:modelValue', 'action', 'reload', 'navigate'])
const set = value => emit('update:modelValue', value)
const help = computed(() => fieldHelp(props.field, props.model))
const command = computed(()=>isCommand(props.field))
const statusOnly=computed(()=>isReadOnlyStatus(props.field))
const converterBusy=ref(false),converterInfo=ref('')
async function converter(){converterBusy.value=true;try{const d=await request('subconverter_version',{url:String(props.modelValue||'')});converterInfo.value=d.version||d.message||JSON.stringify(d)}catch(e){converterInfo.value=e.message}finally{converterBusy.value=false}}
</script>
<template>
  <div class="oc-field"><div class="oc-field-info"><label :for="field.id">{{ displayLabel(field) }}</label><small>{{ field.password ? '凭据按原配置处理' : field.optional ? '允许留空' : '必填' }}</small></div><div class="oc-field-control" :class="{ 'has-error': error }">
  <CustomWidget v-if="customTemplates.includes(field.originalTemplate) || field.template === 'cbi/upload'" :field="field" :values="values" :model="model" :section="section" :fields="fields" :context="context" @changed="set(values[field.id])" @reload="emit('reload')" @navigate="emit('navigate', $event)" />
  <button v-else-if="field.template === 'cbi/button'" @click="emit('action', field)">{{ displayLabel(field) }}</button>
  <label v-else-if="field.template === 'cbi/fvalue'" class="oc-switch"><input :id="field.id" type="checkbox" :checked="String(modelValue) === String(field.enabled)" :disabled="field.readonly" @change="set($event.target.checked ? field.enabled : field.disabled)"><span></span></label>
  <select v-else-if="field.template === 'cbi/lvalue'" :id="field.id" :value="modelValue" :disabled="field.readonly" @change="set($event.target.value)"><option v-for="c in field.choices" :key="c.value" :value="c.value">{{ recordValue(field,c.label) }}</option></select>
  <select v-else-if="field.template === 'cbi/mvalue'" :id="field.id" multiple :disabled="field.readonly" @change="set([...$event.target.selectedOptions].map(o => o.value))"><option v-for="c in field.choices" :value="c.value" :selected="Array.isArray(modelValue) && modelValue.map(String).includes(String(c.value))">{{ c.label }}</option></select>
  <textarea v-else-if="field.template === 'cbi/dynlist'" :id="field.id" :value="Array.isArray(modelValue) ? modelValue.join('\n') : modelValue" :disabled="field.readonly" rows="3" placeholder="每行一个值" @input="set($event.target.value.split('\n').filter(Boolean))"></textarea>
  <textarea v-else-if="field.template === 'cbi/tvalue'" :id="field.id" :value="modelValue" :disabled="field.readonly" rows="5" @input="set($event.target.value)"></textarea>
  <span v-else-if="field.template === 'cbi/dvalue'" class="oc-muted">{{ recordValue(field,modelValue) || '—' }}</span>
  <template v-else-if="field.template === 'cbi/value'"><input :id="field.id" :type="field.password ? 'password' : 'text'" :value="modelValue" :disabled="field.readonly" :placeholder="field.placeholder" :list="field.choices.length ? `${field.id}-choices` : undefined" :aria-invalid="!!error" :aria-describedby="error ? `${field.id}-error` : undefined" autocomplete="off" @input="set($event.target.value)"><datalist v-if="field.choices.length" :id="`${field.id}-choices`"><option v-for="choice in field.choices" :value="choice.value">{{ choice.label }}</option></datalist></template>
  <span v-else class="oc-error">控件读取失败：{{ field.originalTemplate }}</span>
  <div v-if="field.option==='convert_address'" class="oc-actions"><button :disabled="converterBusy||preview||!modelValue" @click="converter">检测转换器版本</button><span role="status" class="oc-muted">{{converterInfo}}</span></div>
  </div><p v-if="error" :id="`${field.id}-error`" class="oc-inline-error" role="alert">{{ error }}</p></div>
  <section v-if="!statusOnly" class="oc-field-help" aria-label="设置说明"><div class="oc-help-heading"><span>设置说明</span><small>{{ command ? '操作说明' : field.template === 'cbi/fvalue' ? '用途与建议' : '填写要求与建议' }}</small></div><dl><div><dt>用途</dt><dd>{{ help.purpose }}</dd></div><div v-if="!command && field.template !== 'cbi/fvalue'"><dt>填写要求</dt><dd><p v-if="!help.range.length || help.format !== '从下面列出的合法值中选择'">{{ help.format }}</p><div v-if="help.range.length" class="oc-choice-reference"><span v-for="item in help.range"><code>{{ item.value }}</code> {{ item.label }}</span></div><small>{{ help.required }}</small></dd></div><div v-if="!command" class="oc-help-recommendation"><dt>推荐设置</dt><dd>{{ help.recommended }}</dd></div><div v-if="!command && field.template !== 'cbi/fvalue' && help.conditions.length"><dt>生效条件</dt><dd><ul><li v-for="condition in help.conditions">{{ condition }}</li></ul><small>条件组之间满足任意一组即可；隐藏的无效项不会提交。</small></dd></div><div v-if="help.notes.length"><dt>原有说明</dt><dd><ul><li v-for="note in help.notes">{{ note }}</li></ul></dd></div></dl><div class="oc-help-links"><a :href="help.source" target="_blank" rel="noreferrer">原设置定义 ↗</a><a :href="help.docs" target="_blank" rel="noreferrer">内核参数文档 ↗</a></div></section>
</template>
