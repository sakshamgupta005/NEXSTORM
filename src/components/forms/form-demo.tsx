'use client'

import React, { useState } from 'react'
import { z } from 'zod'
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, Textarea, RadioGroup } from '@/components/ui/form-controls'
import { FileUpload } from '@/components/ui/file-upload'
import { MultiStepFormStepper } from './multi-step-form-stepper'
import { FormFieldWrapper } from './form-field-wrapper'
import { useForm, useFieldArray, useMultiStepForm } from '@/lib/forms'
import { validateFileSafety } from '@/lib/forms/file-validation'
import type { StepConfig } from '@/lib/forms/types'

// Step 1 Schema: Basic project details
const projectDetailsSchema = z.object({
  title: z
    .string()
    .min(3, 'Project title must be at least 3 characters long')
    .max(50, 'Project title cannot exceed 50 characters'),
  category: z.string().min(1, 'Please select a primary category'),
  environment: z.enum(['production', 'staging', 'development'], {
    message: 'Please select a target environment',
  }),
  description: z
    .string()
    .min(10, 'Description must provide at least 10 characters of context'),
  teamMembers: z
    .array(
      z.object({
        name: z.string().min(2, 'Member name must be at least 2 characters'),
        role: z.string().min(2, 'Member role is required'),
      })
    )
    .min(1, 'At least one team member must be defined'),
})

type ProjectFormValues = z.infer<typeof projectDetailsSchema>

const STEPS: StepConfig<ProjectFormValues>[] = [
  {
    id: 'details',
    title: 'Project Info',
    description: 'Basic project parameters and configuration',
    fields: ['title', 'category', 'environment', 'description'],
  },
  {
    id: 'team',
    title: 'Team Roster',
    description: 'Dynamic field array for collaborators',
    fields: ['teamMembers'],
  },
  {
    id: 'review',
    title: 'Review & Files',
    description: 'Attachment verification and final submission',
  },
]

export function FormDemo() {
  const [simulateServerError, setSimulateServerError] = useState(false)
  const [submissionSuccess, setSubmissionSuccess] = useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  const form = useForm<ProjectFormValues>({
    defaultValues: {
      title: '',
      category: '',
      environment: 'development',
      description: '',
      teamMembers: [{ name: 'Alex Rivera', role: 'Lead Architect' }],
    },
    schema: projectDetailsSchema,
    mode: 'onBlur',
    persistDraftKey: 'hackathon_project_form_draft',
    excludeFromDraft: ['password', 'secretToken'],
  })

  const stepper = useMultiStepForm<ProjectFormValues>({
    steps: STEPS,
  })

  const fieldArray = useFieldArray<{ name: string; role: string }>({
    name: 'teamMembers',
    initialValues: form.values.teamMembers,
    onValuesChange: (newMembers) => {
      form.setValue('teamMembers', newMembers)
    },
  })

  const handleNextStep = async () => {
    // Validate only fields belonging to current step
    const currentFields = stepper.currentStep.fields || []
    if (currentFields.length > 0) {
      const res = await form.validateForm()
      const hasCurrentStepErrors = Object.keys(res.errors).some((key) =>
        currentFields.some((f) => key.startsWith(String(f)))
      )
      if (hasCurrentStepErrors) {
        return
      }
    }

    await stepper.nextStep()
  }

  const handleFileSelect = async (file: File | null) => {
    setUploadedFile(file)
    setFileError(null)

    if (file) {
      const validation = await validateFileSafety(file, {
        maxSizeBytes: 5 * 1024 * 1024,
        allowedExtensions: ['.pdf', '.png', '.jpg'],
        verifyMagicBytes: true,
      })

      if (!validation.isValid) {
        setFileError(validation.error || 'Invalid file')
      }
    }
  }

  const onSubmit = async (values: ProjectFormValues) => {
    setSubmissionSuccess(null)

    if (simulateServerError) {
      // Simulate backend validation error (HTTP 422 Unprocessable Entity)
      throw {
        details: {
          title: 'Project title is already registered by another organization.',
          _form: 'Server rejected the submission due to validation conflicts.',
        },
      }
    }

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 800))

    setSubmissionSuccess(
      `Project "${values.title}" created successfully with ${values.teamMembers.length} member(s)!`
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Forms &amp; Validation Toolkit
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Type-safe Zod schema resolution, multi-step stepper, dynamic field arrays, and safe file uploads.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {form.isDirty && (
            <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-600 dark:text-amber-400">
              Draft Unsaved
            </Badge>
          )}
          <Badge variant="secondary" className="text-xs">
            Step {stepper.currentStepIndex + 1} of {stepper.totalSteps}
          </Badge>
        </div>
      </div>

      {/* Stepper Navigation */}
      <Card>
        <CardContent className="pt-6">
          <MultiStepFormStepper
            steps={stepper.steps}
            currentStepIndex={stepper.currentStepIndex}
            onStepClick={(idx) => stepper.goToStep(idx)}
          />
        </CardContent>
      </Card>

      {/* Main Form Body */}
      <Card>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardHeader>
            <CardTitle className="text-base">{stepper.currentStep.title}</CardTitle>
            <CardDescription>{stepper.currentStep.description}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Top-Level Form Error */}
            {form.errors._form && (
              <div
                role="alert"
                className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-md text-xs font-medium"
              >
                {form.errors._form}
              </div>
            )}

            {/* Submission Success */}
            {submissionSuccess && (
              <div
                role="status"
                className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-md text-xs font-medium"
              >
                {submissionSuccess}
              </div>
            )}

            {/* STEP 1: Basic Project Details */}
            {stepper.currentStepIndex === 0 && (
              <div className="space-y-4">
                <FormFieldWrapper
                  id="title"
                  label="Project Title"
                  required
                  error={form.errors.title}
                  description="A memorable name for your hackathon submission."
                >
                  <Input
                    id="title"
                    placeholder="e.g. EcoTracker Mobile"
                    {...form.register('title')}
                  />
                </FormFieldWrapper>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormFieldWrapper
                    id="category"
                    label="Primary Category"
                    required
                    error={form.errors.category}
                  >
                    <Select
                      id="category"
                      placeholder="Select category..."
                      options={[
                        { value: 'ai', label: 'AI & Machine Learning' },
                        { value: 'web3', label: 'Web3 & Decentralized' },
                        { value: 'climate', label: 'Climate & Sustainability' },
                        { value: 'health', label: 'Healthcare & Biotech' },
                      ]}
                      {...form.register('category')}
                    />
                  </FormFieldWrapper>

                  <FormFieldWrapper
                    id="environment"
                    label="Target Environment"
                    required
                    error={form.errors.environment}
                  >
                    <RadioGroup
                      name="environment"
                      value={String(form.values.environment)}
                      onChange={(val) => form.setValue('environment', val)}
                      options={[
                        { value: 'development', label: 'Dev Sandbox' },
                        { value: 'staging', label: 'Staging' },
                        { value: 'production', label: 'Production' },
                      ]}
                    />
                  </FormFieldWrapper>
                </div>

                <FormFieldWrapper
                  id="description"
                  label="Project Overview"
                  required
                  error={form.errors.description}
                  description="Outline the core user problem and technical solution."
                >
                  <Textarea
                    id="description"
                    placeholder="Describe what the product accomplishes..."
                    rows={3}
                    {...form.register('description')}
                  />
                </FormFieldWrapper>
              </div>
            )}

            {/* STEP 2: Dynamic Team Roster (Field Array) */}
            {stepper.currentStepIndex === 1 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">
                    Team Collaborators ({fieldArray.fields.length})
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => fieldArray.append({ name: '', role: '' })}
                    className="h-7 text-xs"
                  >
                    + Add Member
                  </Button>
                </div>

                {form.errors.teamMembers && (
                  <p role="alert" className="text-xs text-red-600 dark:text-red-400">
                    {form.errors.teamMembers}
                  </p>
                )}

                <div className="space-y-3">
                  {fieldArray.fields.map((field, idx) => (
                    <div
                      key={field.id}
                      className="p-3 bg-muted/40 rounded-lg border border-border/60 flex flex-col sm:flex-row gap-3 items-start sm:items-center"
                    >
                      <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Input
                          placeholder="Member Name"
                          value={field.value.name}
                          onChange={(e) =>
                            fieldArray.update(idx, {
                              ...field.value,
                              name: e.target.value,
                            })
                          }
                          className="text-xs h-8"
                        />
                        <Input
                          placeholder="Role (e.g. Frontend, AI Lead)"
                          value={field.value.role}
                          onChange={(e) =>
                            fieldArray.update(idx, {
                              ...field.value,
                              role: e.target.value,
                            })
                          }
                          className="text-xs h-8"
                        />
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => fieldArray.remove(idx)}
                        disabled={fieldArray.fields.length <= 1}
                        className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10 shrink-0 self-end sm:self-auto"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 3: Safe File Upload & Review */}
            {stepper.currentStepIndex === 2 && (
              <div className="space-y-4">
                <FormFieldWrapper
                  id="spec-upload"
                  label="Project Architecture Specification"
                  error={fileError || undefined}
                  description="Upload design diagram or specification doc (PDF, PNG, JPG under 5MB). Verified via binary magic-bytes."
                >
                  <FileUpload
                    id="spec-upload"
                    accept=".pdf,.png,.jpg"
                    maxSizeBytes={5 * 1024 * 1024}
                    allowedExtensions={['.pdf', '.png', '.jpg']}
                    onFileSelect={handleFileSelect}
                  />
                </FormFieldWrapper>

                {/* Summary Card */}
                <div className="p-3 bg-muted/50 rounded-lg border border-border text-xs space-y-1.5">
                  <div className="font-semibold text-foreground">Submission Summary:</div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Title:</span>
                    <span className="font-medium">{form.values.title || '(none)'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Category:</span>
                    <span className="font-medium">{form.values.category || '(none)'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Environment:</span>
                    <span className="font-medium capitalize">{form.values.environment}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Team Size:</span>
                    <span className="font-medium">{form.values.teamMembers.length} collaborator(s)</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Uploaded Spec:</span>
                    <span className="font-medium">{uploadedFile ? uploadedFile.name : '(none)'}</span>
                  </div>
                </div>

                {/* Simulation Control */}
                <div className="p-3 bg-muted/30 rounded-lg border border-border/40 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-medium">Simulate 422 Server Error</span>
                    <p className="text-[11px] text-muted-foreground">
                      Tests automated mapping of backend conflict payloads to form errors.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={simulateServerError}
                    onChange={(e) => setSimulateServerError(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                  />
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t pt-4">
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => form.restoreDraft()}
                className="text-xs text-muted-foreground"
              >
                Restore Draft
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => form.clearDraft()}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                Clear Draft
              </Button>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              {!stepper.isFirstStep && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => stepper.prevStep()}
                  disabled={form.isSubmitting}
                  className="text-xs"
                >
                  Back
                </Button>
              )}

              {!stepper.isLastStep ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleNextStep}
                  className="text-xs"
                >
                  Continue &rarr;
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="sm"
                  disabled={form.isSubmitting}
                  className="text-xs min-w-[120px]"
                >
                  {form.isSubmitting ? 'Submitting...' : 'Complete Submission'}
                </Button>
              )}
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
