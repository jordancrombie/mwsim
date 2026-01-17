/**
 * CreateContractScreen - Multi-step contract creation flow
 *
 * Steps:
 * 1. Select contract type and counterparty
 * 2. Browse/select oracle event
 * 3. Set stakes and prediction
 * 4. Review and submit
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import { api } from '../services/api';
import { transferSimApi } from '../services/transferSim';
import { ProfileAvatar } from '../components/ProfileAvatar';
import type { ContractType, OracleEvent, AliasLookupResult, CreateContractRequest, BankAccount } from '../types';
import { CONTRACT_TYPE_INFO } from '../types';

interface CreateContractScreenProps {
  onBack: () => void;
  onContractCreated: (contractId: string) => void;
}

type Step = 'type' | 'counterparty' | 'event' | 'stakes' | 'review';

// Format currency amount
const formatAmount = (amount: number): string => {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(amount);
};

export const CreateContractScreen: React.FC<CreateContractScreenProps> = ({
  onBack,
  onContractCreated,
}) => {
  // Step state
  const [currentStep, setCurrentStep] = useState<Step>('type');

  // Form data
  const [contractType, setContractType] = useState<ContractType>('wager');
  const [counterpartyAlias, setCounterpartyAlias] = useState('');
  const [counterpartyInfo, setCounterpartyInfo] = useState<AliasLookupResult | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<OracleEvent | null>(null);
  const [myPrediction, setMyPrediction] = useState('');
  const [myStake, setMyStake] = useState('');
  const [theirStake, setTheirStake] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [events, setEvents] = useState<OracleEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);

  // Load accounts on mount (needed for auto-funding wagers)
  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const { accounts: accts } = await api.getAccounts();
        setAccounts(accts as BankAccount[]);
      } catch (err) {
        console.error('[CreateContract] Failed to load accounts:', err);
      }
    };
    loadAccounts();
  }, []);

  // Load events when reaching event step
  useEffect(() => {
    if (currentStep === 'event' && events.length === 0) {
      loadEvents();
    }
  }, [currentStep]);

  const loadEvents = async () => {
    setEventsLoading(true);
    try {
      const { events: data } = await api.getOracleEvents();
      setEvents(data);
    } catch (err: any) {
      console.error('[CreateContract] Failed to load events:', err);
      // Don't block on error - user can still create custom contracts
    } finally {
      setEventsLoading(false);
    }
  };

  const lookupCounterparty = async () => {
    if (!counterpartyAlias.trim()) return;

    setLookingUp(true);
    setCounterpartyInfo(null);
    setError(null);

    try {
      const result = await transferSimApi.lookupAlias(counterpartyAlias.trim());
      setCounterpartyInfo(result);
      if (!result.found) {
        setError('User not found');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to look up user');
    } finally {
      setLookingUp(false);
    }
  };

  const handleNext = () => {
    const steps: Step[] = ['type', 'counterparty', 'event', 'stakes', 'review'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const steps: Step[] = ['type', 'counterparty', 'event', 'stakes', 'review'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    } else {
      onBack();
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      const request: CreateContractRequest = {
        type: contractType,
        title: title.trim() || `${CONTRACT_TYPE_INFO[contractType].label} with ${counterpartyInfo?.displayName || counterpartyAlias}`,
        description: description.trim() || undefined,
        counterpartyAlias: counterpartyAlias.trim(),
        event: selectedEvent
          ? {
              oracle: selectedEvent.oracle,
              event_id: selectedEvent.event_id,
              myPrediction,
            }
          : {
              oracle: 'custom',
              event_id: 'custom',
              myPrediction: myPrediction || 'true',
            },
        myStake: parseFloat(myStake),
        theirStake: parseFloat(theirStake || myStake),
      };

      const contract = await api.createContract(request);

      // Auto-fund wagers immediately after creation
      if (contractType === 'wager' && accounts.length > 0) {
        console.log('[CreateContract] Auto-funding wager contract:', contract.id);
        try {
          const idempotencyKey = uuidv4();
          await api.fundContract(contract.id, accounts[0].accountId, idempotencyKey);
          console.log('[CreateContract] Auto-fund successful');
        } catch (fundErr: any) {
          console.error('[CreateContract] Auto-fund failed:', fundErr);
          // Still proceed - contract was created, funding can be done later
          Alert.alert(
            'Contract Created',
            'Your wager was created but auto-funding failed. You can fund it manually from the contract details.'
          );
        }
      }

      onContractCreated(contract.id);
    } catch (err: any) {
      setError(err.message || 'Failed to create contract');
      Alert.alert('Error', err.message || 'Failed to create contract');
    } finally {
      setLoading(false);
    }
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 'type':
        return true;
      case 'counterparty':
        return counterpartyInfo?.found === true;
      case 'event':
        return selectedEvent !== null || myPrediction.trim() !== '';
      case 'stakes':
        const stake = parseFloat(myStake);
        return !isNaN(stake) && stake > 0 && stake <= 100;
      case 'review':
        return true;
      default:
        return false;
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 'type':
        return renderTypeStep();
      case 'counterparty':
        return renderCounterpartyStep();
      case 'event':
        return renderEventStep();
      case 'stakes':
        return renderStakesStep();
      case 'review':
        return renderReviewStep();
    }
  };

  const renderTypeStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>What type of contract?</Text>
      <Text style={styles.stepSubtitle}>Select the contract type that best fits your agreement.</Text>

      {(Object.keys(CONTRACT_TYPE_INFO) as ContractType[]).map((type) => {
        const info = CONTRACT_TYPE_INFO[type];
        const isSelected = contractType === type;

        return (
          <TouchableOpacity
            key={type}
            style={[styles.typeCard, isSelected && styles.typeCardSelected]}
            onPress={() => setContractType(type)}
          >
            <Text style={styles.typeIcon}>{info.icon}</Text>
            <View style={styles.typeInfo}>
              <Text style={[styles.typeLabel, isSelected && styles.typeLabelSelected]}>
                {info.label}
              </Text>
              <Text style={styles.typeDescription}>{info.description}</Text>
            </View>
            {isSelected && <Text style={styles.checkmark}>&#10003;</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderCounterpartyStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Who are you contracting with?</Text>
      <Text style={styles.stepSubtitle}>Enter their alias (e.g., @username or email).</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Enter alias or email"
          value={counterpartyAlias}
          onChangeText={setCounterpartyAlias}
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={lookupCounterparty}
        />
        <TouchableOpacity
          style={styles.lookupButton}
          onPress={lookupCounterparty}
          disabled={lookingUp || !counterpartyAlias.trim()}
        >
          {lookingUp ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.lookupButtonText}>Look Up</Text>
          )}
        </TouchableOpacity>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      {counterpartyInfo?.found && (
        <View style={styles.counterpartyCard}>
          <ProfileAvatar
            imageUrl={counterpartyInfo.profileImageUrl}
            displayName={counterpartyInfo.displayName || counterpartyAlias}
            initialsColor={counterpartyInfo.initialsColor}
            size="medium"
          />
          <View style={styles.counterpartyInfo}>
            <Text style={styles.counterpartyName}>{counterpartyInfo.displayName}</Text>
            <Text style={styles.counterpartyAlias}>{counterpartyAlias}</Text>
            {counterpartyInfo.bankName && (
              <Text style={styles.counterpartyBank}>{counterpartyInfo.bankName}</Text>
            )}
          </View>
          <Text style={styles.verifiedBadge}>&#10003;</Text>
        </View>
      )}
    </View>
  );

  const renderEventStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>What's the condition?</Text>
      <Text style={styles.stepSubtitle}>Select an event or create a custom condition.</Text>

      {eventsLoading ? (
        <ActivityIndicator size="large" color="#1976D2" style={{ marginTop: 32 }} />
      ) : events.length > 0 ? (
        <ScrollView style={styles.eventsList} showsVerticalScrollIndicator={false}>
          {events.map((event) => {
            const isSelected = selectedEvent?.event_id === event.event_id;
            return (
              <TouchableOpacity
                key={event.event_id}
                style={[styles.eventCard, isSelected && styles.eventCardSelected]}
                onPress={() => {
                  setSelectedEvent(event);
                  if (event.teams && event.teams.length > 0) {
                    setMyPrediction(event.teams[0].id);
                  }
                }}
              >
                <View style={styles.eventInfo}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <Text style={styles.eventType}>{event.eventType}</Text>
                  {event.teams && (
                    <Text style={styles.eventTeams}>{event.teams.map(t => t.name).join(' vs ')}</Text>
                  )}
                </View>
                {isSelected && <Text style={styles.checkmark}>&#10003;</Text>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : (
        <View style={styles.noEvents}>
          <Text style={styles.noEventsText}>No events available. Create a custom condition.</Text>
        </View>
      )}

      {selectedEvent && selectedEvent.teams && (
        <View style={styles.predictionContainer}>
          <Text style={styles.predictionLabel}>Your prediction:</Text>
          <View style={styles.predictionOptions}>
            {selectedEvent.teams.map((team) => (
              <TouchableOpacity
                key={team.id}
                style={[
                  styles.predictionOption,
                  myPrediction === team.id && styles.predictionOptionSelected,
                ]}
                onPress={() => setMyPrediction(team.id)}
              >
                <Text
                  style={[
                    styles.predictionOptionText,
                    myPrediction === team.id && styles.predictionOptionTextSelected,
                  ]}
                >
                  {team.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {!selectedEvent && (
        <View style={styles.customCondition}>
          <Text style={styles.customConditionLabel}>Custom condition:</Text>
          <TextInput
            style={styles.input}
            placeholder="Describe the condition..."
            value={myPrediction}
            onChangeText={setMyPrediction}
            multiline
          />
        </View>
      )}
    </View>
  );

  const renderStakesStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Set the stakes</Text>
      <Text style={styles.stepSubtitle}>How much are you wagering? (Max $100 for MVP)</Text>

      <View style={styles.stakeInputContainer}>
        <Text style={styles.stakeLabel}>Your stake</Text>
        <View style={styles.stakeInputWrapper}>
          <Text style={styles.currencySymbol}>$</Text>
          <TextInput
            style={styles.stakeInput}
            placeholder="0.00"
            value={myStake}
            onChangeText={setMyStake}
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      <View style={styles.stakeInputContainer}>
        <Text style={styles.stakeLabel}>Their stake (same if empty)</Text>
        <View style={styles.stakeInputWrapper}>
          <Text style={styles.currencySymbol}>$</Text>
          <TextInput
            style={styles.stakeInput}
            placeholder={myStake || '0.00'}
            value={theirStake}
            onChangeText={setTheirStake}
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      <View style={styles.potPreview}>
        <Text style={styles.potPreviewLabel}>Total Pot</Text>
        <Text style={styles.potPreviewAmount}>
          {formatAmount(
            (parseFloat(myStake) || 0) + (parseFloat(theirStake) || parseFloat(myStake) || 0)
          )}
        </Text>
      </View>

      <View style={styles.titleContainer}>
        <Text style={styles.titleLabel}>Contract title (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder={`${CONTRACT_TYPE_INFO[contractType].label} with ${counterpartyInfo?.displayName || 'counterparty'}`}
          value={title}
          onChangeText={setTitle}
        />
      </View>
    </View>
  );

  const renderReviewStep = () => {
    const totalPot = (parseFloat(myStake) || 0) + (parseFloat(theirStake) || parseFloat(myStake) || 0);

    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>Review your contract</Text>
        <Text style={styles.stepSubtitle}>Make sure everything looks correct before submitting.</Text>

        <View style={styles.reviewCard}>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Type</Text>
            <Text style={styles.reviewValue}>
              {CONTRACT_TYPE_INFO[contractType].icon} {CONTRACT_TYPE_INFO[contractType].label}
            </Text>
          </View>

          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Counterparty</Text>
            <View style={styles.reviewValueRow}>
              <ProfileAvatar
                imageUrl={counterpartyInfo?.profileImageUrl}
                displayName={counterpartyInfo?.displayName || counterpartyAlias}
                initialsColor={counterpartyInfo?.initialsColor}
                size="small"
              />
              <Text style={[styles.reviewValue, { marginLeft: 8, flex: 0 }]} numberOfLines={1}>
                {counterpartyInfo?.displayName || counterpartyAlias}
              </Text>
            </View>
          </View>

          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Condition</Text>
            <Text style={styles.reviewValue}>
              {selectedEvent ? selectedEvent.title : myPrediction}
            </Text>
          </View>

          {selectedEvent && myPrediction && (
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Your prediction</Text>
              <Text style={styles.reviewValue}>{myPrediction}</Text>
            </View>
          )}

          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Your stake</Text>
            <Text style={styles.reviewValue}>{formatAmount(parseFloat(myStake) || 0)}</Text>
          </View>

          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Their stake</Text>
            <Text style={styles.reviewValue}>
              {formatAmount(parseFloat(theirStake) || parseFloat(myStake) || 0)}
            </Text>
          </View>

          <View style={[styles.reviewRow, styles.reviewRowTotal]}>
            <Text style={styles.reviewLabelTotal}>Total Pot</Text>
            <Text style={styles.reviewValueTotal}>{formatAmount(totalPot)}</Text>
          </View>
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Text style={styles.disclaimer}>
          By creating this contract, you agree to place a hold on your stake amount until the contract is settled.
        </Text>
      </View>
    );
  };

  // Step progress indicator
  const steps: { key: Step; label: string }[] = [
    { key: 'type', label: 'Type' },
    { key: 'counterparty', label: 'Who' },
    { key: 'event', label: 'What' },
    { key: 'stakes', label: 'Stakes' },
    { key: 'review', label: 'Review' },
  ];
  const currentStepIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>&lt; {currentStep === 'type' ? 'Cancel' : 'Back'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>New Contract</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Progress indicator */}
      <View style={styles.progressContainer}>
        {steps.map((step, index) => (
          <View key={step.key} style={styles.progressStep}>
            <View
              style={[
                styles.progressDot,
                index <= currentStepIndex && styles.progressDotActive,
                index < currentStepIndex && styles.progressDotCompleted,
              ]}
            >
              {index < currentStepIndex ? (
                <Text style={styles.progressCheckmark}>&#10003;</Text>
              ) : (
                <Text style={styles.progressNumber}>{index + 1}</Text>
              )}
            </View>
            <Text
              style={[
                styles.progressLabel,
                index <= currentStepIndex && styles.progressLabelActive,
              ]}
            >
              {step.label}
            </Text>
          </View>
        ))}
      </View>

      {/* Content */}
      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {renderStepContent()}
      </ScrollView>

      {/* Footer buttons */}
      <View style={styles.footer}>
        {currentStep === 'review' ? (
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Create Contract</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.nextButton, !canProceed() && styles.buttonDisabled]}
            onPress={handleNext}
            disabled={!canProceed()}
          >
            <Text style={styles.nextButtonText}>Continue</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    paddingVertical: 8,
    paddingRight: 16,
    minWidth: 80,
  },
  backButtonText: {
    fontSize: 17,
    color: '#1976D2',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  headerSpacer: {
    minWidth: 80,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  progressStep: {
    alignItems: 'center',
  },
  progressDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressDotActive: {
    backgroundColor: '#1976D2',
  },
  progressDotCompleted: {
    backgroundColor: '#10B981',
  },
  progressNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  progressCheckmark: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  progressLabel: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  progressLabelActive: {
    color: '#1976D2',
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  stepContent: {
    padding: 24,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
    lineHeight: 20,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  typeCardSelected: {
    borderColor: '#1976D2',
    backgroundColor: '#EBF5FF',
  },
  typeIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  typeInfo: {
    flex: 1,
  },
  typeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  typeLabelSelected: {
    color: '#1976D2',
  },
  typeDescription: {
    fontSize: 13,
    color: '#6B7280',
  },
  checkmark: {
    fontSize: 20,
    color: '#1976D2',
    fontWeight: '700',
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
  },
  lookupButton: {
    backgroundColor: '#1976D2',
    paddingHorizontal: 20,
    marginLeft: 12,
    borderRadius: 12,
    justifyContent: 'center',
  },
  lookupButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    marginBottom: 16,
  },
  counterpartyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#10B981',
  },
  counterpartyInfo: {
    flex: 1,
    marginLeft: 16,
  },
  counterpartyName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  counterpartyAlias: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  counterpartyBank: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  verifiedBadge: {
    fontSize: 24,
    color: '#10B981',
  },
  eventsList: {
    maxHeight: 300,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  eventCardSelected: {
    borderColor: '#1976D2',
    backgroundColor: '#EBF5FF',
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  eventType: {
    fontSize: 12,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  eventTeams: {
    fontSize: 14,
    color: '#6B7280',
  },
  noEvents: {
    padding: 32,
    alignItems: 'center',
  },
  noEventsText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  predictionContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  predictionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  predictionOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  predictionOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    marginRight: 12,
    marginBottom: 8,
  },
  predictionOptionSelected: {
    backgroundColor: '#1976D2',
  },
  predictionOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  predictionOptionTextSelected: {
    color: '#fff',
  },
  customCondition: {
    marginTop: 16,
  },
  customConditionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  stakeInputContainer: {
    marginBottom: 24,
  },
  stakeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  stakeInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '600',
    color: '#6B7280',
    marginRight: 8,
  },
  stakeInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
    paddingVertical: 16,
  },
  potPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    marginBottom: 24,
  },
  potPreviewLabel: {
    fontSize: 14,
    color: '#065F46',
    fontWeight: '500',
  },
  potPreviewAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#059669',
  },
  titleContainer: {
    marginTop: 8,
  },
  titleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  reviewCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  reviewRowTotal: {
    borderBottomWidth: 0,
    paddingTop: 16,
  },
  reviewLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  reviewValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  reviewValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
    marginLeft: 16,
  },
  reviewLabelTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  reviewValueTotal: {
    fontSize: 20,
    fontWeight: '700',
    color: '#10B981',
  },
  disclaimer: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
  },
  footer: {
    padding: 16,
    paddingBottom: 32,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  nextButton: {
    backgroundColor: '#1976D2',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  submitButton: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

export default CreateContractScreen;
