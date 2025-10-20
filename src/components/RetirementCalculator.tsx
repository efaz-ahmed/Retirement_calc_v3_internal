import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { Alert, AlertDescription } from './ui/alert';
import { Switch } from './ui/switch';
import { Calculator, ChevronDown, HelpCircle, AlertTriangle } from 'lucide-react';
import { RetirementResults } from './RetirementResults';

export interface InvestmentVehicle {
  name: string;
  returnRate: number;
  riskLevel: string;
  volatility?: number;
}

export interface CalculationInputs {
  currentAge: number;
  retirementAge: number;
  currentIncome: number;
  investmentVehicle: InvestmentVehicle;
  replacementRatio: number;
  safeWithdrawalRate: number;
}

export interface MonteCarloProjection {
  year: number;
  age: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  target: number;
  deterministic: number;
}

export interface SequenceScenario {
  name: string;
  description: string;
  preRetirement: number[];
  postRetirement: number[];
  finalValue: number;
  survivalYears: number;
  color: string;
  preRetirementReturnRate: number;
  postRetirementReturnRate: number;
}

export interface SequenceProjection {
  year: number;
  age: number;
  isRetirementYear: boolean;
  isCriticalZone: boolean;
  bestCase: number;
  worstCase: number;
  earlyBear: number;
  average: number;
}

export interface CalculationResults {
  yearsUntilRetirement: number;
  targetRetirementCorpus: number;
  monthlyInvestmentNeeded: number;
  annualInvestmentNeeded: number;
  totalContributions: number;
  totalReturns: number;
  yearlyProjections: YearlyProjection[];
  postRetirementProjections: PostRetirementProjection[];
  replacementRatio: number;
  annualRetirementIncome: number;
  retirementDuration: number;
  safeWithdrawalRate: number;
  isUnrealistic: boolean;
  incomePercentageNeeded: number;
  monteCarloProjections?: MonteCarloProjection[];
  postRetirementVehicle: InvestmentVehicle;
  sequenceScenarios?: SequenceScenario[];
  sequenceProjections?: SequenceProjection[];
}

export interface PostRetirementProjection {
  year: number;
  age: number;
  withdrawal: number;
  portfolioValue: number;
}

export interface YearlyProjection {
  year: number;
  age: number;
  annualContribution: number;
  cumulativeContribution: number;
  investmentReturns: number;
  totalValue: number;
}

const investmentVehicles: InvestmentVehicle[] = [
  {
    name: 'Very Low Risk',
    returnRate: 4,
    riskLevel: 'Very Low Risk',
    volatility: 0
  },
  {
    name: 'Low Risk',
    returnRate: 7.5,
    riskLevel: 'Low Risk',
    volatility: 0
  },
  {
    name: 'Moderate Risk',
    returnRate: 12,
    riskLevel: 'Moderate Risk',
    volatility: 15
  },
  {
    name: 'High Risk',
    returnRate: 18,
    riskLevel: 'High Risk',
    volatility: 25
  },
  {
    name: 'Very High Risk',
    returnRate: 22,
    riskLevel: 'Very High Risk',
    volatility: 35
  }
];

// Box-Muller transform to generate normally distributed random numbers
function generateNormalRandom(mean: number, stdDev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z0 * stdDev;
}

// Calculate sequence of returns scenarios
function calculateSequenceRisk(
  yearsUntilRetirement: number,
  annualInvestment: number,
  preRetirementReturn: number,
  volatility: number,
  retirementDuration: number,
  annualRetirementIncome: number,
  inflationRate: number,
  salaryGrowthRate: number,
  postRetirementReturn: number,
  currentAge: number
): { scenarios: SequenceScenario[], projections: SequenceProjection[] } {
  
  // Generate different return sequences with same average
  const generateSequence = (type: string, years: number, baseReturn: number, vol: number): number[] => {
    const returns: number[] = [];
    
    if (type === 'bestCase') {
      // Good returns late (best for accumulation, worst for retirement)
      for (let i = 0; i < years; i++) {
        const progress = i / years;
        returns.push((baseReturn + vol * (progress - 0.5) * 2) / 100);
      }
    } else if (type === 'worstCase') {
      // Good returns early, bad returns late (worst for accumulation, best for retirement)
      for (let i = 0; i < years; i++) {
        const progress = i / years;
        returns.push((baseReturn - vol * (progress - 0.5) * 2) / 100);
      }
    } else if (type === 'earlyBear') {
      // Bear market early, bull market late
      for (let i = 0; i < years; i++) {
        if (i < years * 0.3) {
          returns.push((baseReturn - vol * 0.8) / 100);
        } else {
          returns.push((baseReturn + vol * 0.4) / 100);
        }
      }
    } else {
      // Average returns throughout
      for (let i = 0; i < years; i++) {
        returns.push(baseReturn / 100);
      }
    }
    
    return returns;
  };

  // Calculate portfolio value through accumulation and retirement
  const simulateFullCycle = (preReturns: number[], postReturns: number[]): { finalValue: number, survivalYears: number, values: number[] } => {
    const allValues: number[] = [0];
    let portfolioValue = 0;
    
    // Accumulation phase
    for (let year = 0; year < yearsUntilRetirement; year++) {
      const yearContribution = annualInvestment * Math.pow(1 + salaryGrowthRate, year);
      portfolioValue = (portfolioValue + yearContribution) * (1 + preReturns[year]);
      allValues.push(portfolioValue);
    }
    
    // Retirement phase
    let survivalYears = retirementDuration;
    for (let year = 0; year < retirementDuration; year++) {
      const withdrawal = annualRetirementIncome * Math.pow(1 + inflationRate, year);
      portfolioValue = (portfolioValue - withdrawal) * (1 + postReturns[year]);
      allValues.push(Math.max(0, portfolioValue));
      
      if (portfolioValue <= 0 && survivalYears === retirementDuration) {
        survivalYears = year;
      }
    }
    
    return { 
      finalValue: Math.max(0, portfolioValue), 
      survivalYears,
      values: allValues
    };
  };

  // Generate scenarios for PRE-RETIREMENT (using pre-retirement return and volatility)
  const preRetBestCase = generateSequence('bestCase', yearsUntilRetirement, preRetirementReturn, volatility);
  const preRetWorstCase = generateSequence('worstCase', yearsUntilRetirement, preRetirementReturn, volatility);
  const preRetEarlyBear = generateSequence('earlyBear', yearsUntilRetirement, preRetirementReturn, volatility);
  const preRetAverage = generateSequence('average', yearsUntilRetirement, preRetirementReturn, volatility);
  
  // Generate scenarios for POST-RETIREMENT 
  // All scenarios use the same conservative post-retirement vehicle (as chosen by user, default 4%)
  // This represents de-risking in retirement - using steady, low-volatility returns
  const postRetSteady = generateSequence('average', retirementDuration, postRetirementReturn, 0); // No volatility - steady returns
  
  // Use the same steady post-retirement returns for all scenarios
  const postRetBestCase = postRetSteady;
  const postRetWorstCase = postRetSteady;
  const postRetEarlyBear = postRetSteady;
  const postRetAverage = postRetSteady;

  const bestCaseResult = simulateFullCycle(preRetBestCase, postRetBestCase);
  const worstCaseResult = simulateFullCycle(preRetWorstCase, postRetWorstCase);
  const earlyBearResult = simulateFullCycle(preRetEarlyBear, postRetEarlyBear);
  const averageResult = simulateFullCycle(preRetAverage, postRetAverage);

  const scenarios: SequenceScenario[] = [
    {
      name: 'Bull Market Into Retirement',
      description: 'Strong returns leading up to retirement, steady conservative returns after',
      preRetirement: preRetBestCase,
      postRetirement: postRetBestCase,
      finalValue: bestCaseResult.finalValue,
      survivalYears: bestCaseResult.survivalYears,
      color: '#22c55e',
      preRetirementReturnRate: preRetirementReturn,
      postRetirementReturnRate: postRetirementReturn
    },
    {
      name: 'Bear Market Into Retirement',
      description: 'Poor returns before retirement, steady conservative returns after',
      preRetirement: preRetWorstCase,
      postRetirement: postRetWorstCase,
      finalValue: worstCaseResult.finalValue,
      survivalYears: worstCaseResult.survivalYears,
      color: '#ef4444',
      preRetirementReturnRate: preRetirementReturn,
      postRetirementReturnRate: postRetirementReturn
    },
    {
      name: 'Early Bear, Late Bull',
      description: 'Poor returns early in career, strong returns later',
      preRetirement: preRetEarlyBear,
      postRetirement: postRetEarlyBear,
      finalValue: earlyBearResult.finalValue,
      survivalYears: earlyBearResult.survivalYears,
      color: '#f59e0b',
      preRetirementReturnRate: preRetirementReturn,
      postRetirementReturnRate: postRetirementReturn
    },
    {
      name: 'Steady Average Returns',
      description: 'Consistent average returns throughout',
      preRetirement: preRetAverage,
      postRetirement: postRetAverage,
      finalValue: averageResult.finalValue,
      survivalYears: averageResult.survivalYears,
      color: '#3b82f6',
      preRetirementReturnRate: preRetirementReturn,
      postRetirementReturnRate: postRetirementReturn
    }
  ];

  // Create combined projections for visualization
  const projections: SequenceProjection[] = [];
  const totalYears = yearsUntilRetirement + retirementDuration + 1;
  
  for (let i = 0; i < totalYears; i++) {
    const year = new Date().getFullYear() + i;
    const age = currentAge + i;
    const isRetirementYear = i === yearsUntilRetirement;
    const isCriticalZone = i >= yearsUntilRetirement - 5 && i < yearsUntilRetirement;
    
    projections.push({
      year,
      age,
      isRetirementYear,
      isCriticalZone,
      bestCase: bestCaseResult.values[i] || 0,
      worstCase: worstCaseResult.values[i] || 0,
      earlyBear: earlyBearResult.values[i] || 0,
      average: averageResult.values[i] || 0
    });
  }

  return { scenarios, projections };
}

// Run Monte Carlo simulation
function runMonteCarloSimulation(
  yearsUntilRetirement: number,
  annualInvestment: number,
  expectedReturn: number,
  volatility: number,
  targetCorpus: number,
  currentAge: number,
  salaryGrowthRate: number
): MonteCarloProjection[] {
  const numSimulations = 1000;
  const simulations: number[][] = [];

  // Run simulations
  for (let sim = 0; sim < numSimulations; sim++) {
    const yearlyValues: number[] = [0];
    let portfolioValue = 0;

    for (let year = 1; year <= yearsUntilRetirement; year++) {
      const annualReturn = generateNormalRandom(expectedReturn / 100, volatility / 100);
      const yearContribution = annualInvestment * Math.pow(1 + salaryGrowthRate, year - 1);
      portfolioValue = (portfolioValue + yearContribution) * (1 + annualReturn);
      yearlyValues.push(portfolioValue);
    }

    simulations.push(yearlyValues);
  }

  // Calculate percentiles for each year
  const projections: MonteCarloProjection[] = [];
  
  for (let year = 0; year <= yearsUntilRetirement; year++) {
    const yearValues = simulations.map(sim => sim[year]).sort((a, b) => a - b);
    
    // Calculate deterministic value with salary growth
    let deterministicValue = 0;
    if (year > 0) {
      for (let i = 1; i <= year; i++) {
        const yearContribution = annualInvestment * Math.pow(1 + salaryGrowthRate, i - 1);
        deterministicValue = (deterministicValue + yearContribution) * (1 + expectedReturn / 100);
      }
    }

    projections.push({
      year: new Date().getFullYear() + year,
      age: currentAge + year,
      p10: yearValues[Math.floor(numSimulations * 0.1)],
      p25: yearValues[Math.floor(numSimulations * 0.25)],
      p50: yearValues[Math.floor(numSimulations * 0.5)],
      p75: yearValues[Math.floor(numSimulations * 0.75)],
      p90: yearValues[Math.floor(numSimulations * 0.9)],
      target: targetCorpus,
      deterministic: deterministicValue
    });
  }

  return projections;
}

export function RetirementCalculator() {
  const [currentAge, setCurrentAge] = useState<string>('24');
  const [retirementAge, setRetirementAge] = useState<string>('40');
  const [currentIncome, setCurrentIncome] = useState<string>('52000');
  const [selectedVehicle, setSelectedVehicle] = useState<string>('1');
  const [retirementIncomePercent, setRetirementIncomePercent] = useState<string>('75');
  const [safeWithdrawalRate, setSafeWithdrawalRate] = useState<string>('4');
  const [salaryGrowth, setSalaryGrowth] = useState<string>('2');
  const [useLowestRiskPostRetirement, setUseLowestRiskPostRetirement] = useState<boolean>(true);
  const [postRetirementVehicle, setPostRetirementVehicle] = useState<string>('0');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [results, setResults] = useState<CalculationResults | null>(null);

  const calculateRetirement = () => {
    const age = parseInt(currentAge);
    const retAge = parseInt(retirementAge);
    const income = parseFloat(currentIncome);
    const vehicle = investmentVehicles[parseInt(selectedVehicle)];
    const replacementRatio = parseFloat(retirementIncomePercent) / 100;
    const withdrawalRate = parseFloat(safeWithdrawalRate) / 100;
    const annualSalaryGrowth = parseFloat(salaryGrowth) / 100;

    // Validate all inputs
    if (isNaN(age) || isNaN(retAge) || isNaN(income) || isNaN(replacementRatio) || 
        isNaN(withdrawalRate) || isNaN(annualSalaryGrowth)) {
      alert('Please ensure all fields are filled with valid numbers');
      return;
    }

    if (age >= retAge) {
      alert('Retirement age must be greater than current age');
      return;
    }

    if (income <= 0) {
      alert('Current income must be greater than zero');
      return;
    }

    // Financial assumptions
    const retirementDuration = 40; // Expected years in retirement (changed to 40)
    const inflationRate = 0.03; // 3% annual inflation

    const yearsUntilRetirement = retAge - age;
    
    // Calculate future income at retirement (accounting for salary growth)
    const futureIncome = income * Math.pow(1 + annualSalaryGrowth, yearsUntilRetirement);
    const annualRetirementIncome = futureIncome * replacementRatio;

    // Calculate future value of required retirement income (accounting for inflation)
    const futureRetirementIncome = annualRetirementIncome * Math.pow(1 + inflationRate, yearsUntilRetirement);

    // Calculate total corpus needed (using safe withdrawal rate)
    const targetRetirementCorpus = futureRetirementIncome / withdrawalRate;

    // Alternative calculation: Present value of annuity for retirement years
    // This accounts for investment returns during retirement
    const realReturnInRetirement = (vehicle.returnRate / 100) - inflationRate;
    const pvFactor = realReturnInRetirement > 0 
      ? (1 - Math.pow(1 + realReturnInRetirement, -retirementDuration)) / realReturnInRetirement
      : retirementDuration;
    const targetCorpusAnnuity = futureRetirementIncome * pvFactor;

    // Use the larger of the two calculations for safety
    const finalTargetCorpus = Math.max(targetRetirementCorpus, targetCorpusAnnuity);

    // Calculate average annual investment needed
    // We need to work backwards from the target to find the right contribution
    // This is complex with salary growth, so we'll use an iterative approach
    
    // Start with a simple average
    let testAnnualInvestment = finalTargetCorpus / yearsUntilRetirement / 1.5; // rough estimate
    let iterations = 0;
    const maxIterations = 100;
    
    while (iterations < maxIterations) {
      let testTotalValue = 0;
      let testCumulativeContribution = 0;
      
      for (let i = 1; i <= yearsUntilRetirement; i++) {
        const yearContribution = testAnnualInvestment * Math.pow(1 + annualSalaryGrowth, i - 1);
        
        testCumulativeContribution += yearContribution;
        testTotalValue = (testTotalValue + yearContribution) * (1 + vehicle.returnRate / 100);
      }
      
      const difference = finalTargetCorpus - testTotalValue;
      
      if (Math.abs(difference) < 1000) { // within £1000
        break;
      }
      
      testAnnualInvestment += difference / yearsUntilRetirement / 10;
      iterations++;
    }
    
    const annualInvestment = testAnnualInvestment;
    const monthlyInvestment = annualInvestment / 12;

    // Generate yearly projections with correct annual investment
    const yearlyProjections: YearlyProjection[] = [];
    let cumulativeContribution = 0;
    let totalValue = 0;

    for (let i = 0; i <= yearsUntilRetirement; i++) {
      const currentYear = new Date().getFullYear() + i;
      const currentUserAge = age + i;
      
      if (i > 0) {
        const yearContribution = annualInvestment * Math.pow(1 + annualSalaryGrowth, i - 1);
        cumulativeContribution += yearContribution;
        totalValue = (totalValue + yearContribution) * (1 + vehicle.returnRate / 100);
      }

      const investmentReturns = totalValue - cumulativeContribution;

      yearlyProjections.push({
        year: currentYear,
        age: currentUserAge,
        annualContribution: i === 0 ? 0 : annualInvestment * Math.pow(1 + annualSalaryGrowth, i - 1),
        cumulativeContribution,
        investmentReturns,
        totalValue
      });
    }

    // Check if unrealistic (more than 75% of income)
    const incomePercentageNeeded = (annualInvestment / income) * 100;
    const isUnrealistic = incomePercentageNeeded > 75;

    // Calculate total contributions correctly (accounting for salary growth)
    const totalContributions = yearlyProjections[yearlyProjections.length - 1].cumulativeContribution;
    const totalReturns = yearlyProjections[yearlyProjections.length - 1].totalValue - totalContributions;

    // Get post-retirement vehicle
    const postRetVehicle = useLowestRiskPostRetirement 
      ? investmentVehicles[0] // Very Low Risk - 4%
      : investmentVehicles[parseInt(postRetirementVehicle)];

    // Generate post-retirement projections
    const postRetirementProjections: PostRetirementProjection[] = [];
    let portfolioValue = finalTargetCorpus;
    
    for (let i = 0; i <= retirementDuration; i++) {
      const currentYear = new Date().getFullYear() + yearsUntilRetirement + i;
      const currentUserAge = retAge + i;
      
      const withdrawal = i === 0 ? 0 : futureRetirementIncome * Math.pow(1 + inflationRate, i - 1);
      
      if (i > 0) {
        portfolioValue = (portfolioValue - withdrawal) * (1 + postRetVehicle.returnRate / 100);
      }

      postRetirementProjections.push({
        year: currentYear,
        age: currentUserAge,
        withdrawal,
        portfolioValue: Math.max(0, portfolioValue)
      });
    }

    // Run Monte Carlo simulation for moderate, high, and very high risk
    let monteCarloProjections: MonteCarloProjection[] | undefined;
    let sequenceScenarios: SequenceScenario[] | undefined;
    let sequenceProjections: SequenceProjection[] | undefined;
    
    if (vehicle.volatility && vehicle.volatility > 0) {
      monteCarloProjections = runMonteCarloSimulation(
        yearsUntilRetirement,
        annualInvestment,
        vehicle.returnRate,
        vehicle.volatility,
        finalTargetCorpus,
        age,
        annualSalaryGrowth
      );

      // Calculate sequence of returns risk
      const sequenceResults = calculateSequenceRisk(
        yearsUntilRetirement,
        annualInvestment,
        vehicle.returnRate,
        vehicle.volatility,
        retirementDuration,
        futureRetirementIncome,
        inflationRate,
        annualSalaryGrowth,
        postRetVehicle.returnRate,
        age
      );
      
      sequenceScenarios = sequenceResults.scenarios;
      sequenceProjections = sequenceResults.projections;
    }

    setResults({
      yearsUntilRetirement,
      targetRetirementCorpus: finalTargetCorpus,
      monthlyInvestmentNeeded: monthlyInvestment,
      annualInvestmentNeeded: annualInvestment,
      totalContributions,
      totalReturns,
      yearlyProjections,
      postRetirementProjections,
      replacementRatio,
      annualRetirementIncome: futureRetirementIncome,
      retirementDuration,
      safeWithdrawalRate: withdrawalRate,
      isUnrealistic,
      incomePercentageNeeded,
      monteCarloProjections,
      postRetirementVehicle: postRetVehicle,
      sequenceScenarios,
      sequenceProjections
    });
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 space-y-6">
      <div className="text-center space-y-2 py-6">
        <h1 className="text-5xl font-bold">Retire on Time: Investment Calculator</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Information</CardTitle>
          <CardDescription>
            Enter your details to calculate your retirement investment needs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="currentAge">Current Age</Label>
              <Input
                id="currentAge"
                type="number"
                value={currentAge}
                onChange={(e) => setCurrentAge(e.target.value)}
                placeholder="24"
                min="18"
                max="100"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="retirementAge">Target Retirement Age</Label>
              <Input
                id="retirementAge"
                type="number"
                value={retirementAge}
                onChange={(e) => setRetirementAge(e.target.value)}
                placeholder="40"
                min="18"
                max="100"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currentIncome">Current Annual Income (£)</Label>
              <Input
                id="currentIncome"
                type="number"
                value={currentIncome}
                onChange={(e) => setCurrentIncome(e.target.value)}
                placeholder="52000"
                min="0"
                step="1000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="investmentVehicle">Investment Vehicle Return</Label>
              <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                <SelectTrigger id="investmentVehicle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {investmentVehicles.map((vehicle, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      {vehicle.name} - {vehicle.returnRate}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(parseInt(selectedVehicle) === 3 || parseInt(selectedVehicle) === 4) && (
                <Alert variant="destructive" className="mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Warning: {investmentVehicles[parseInt(selectedVehicle)].returnRate}% returns are not sustainable over long time horizons. 
                    Markets will fluctuate significantly, and actual returns may vary dramatically from year to year.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>

          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen} className="mt-6">
            <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 rounded-md hover:bg-muted transition-colors">
              <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
              <span className="font-medium">Advanced Assumptions</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="retirementIncome">Retirement Income Needed (%)</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        The percentage of your current income you'll need in retirement. Most people need 70-80% 
                        of their pre-retirement income, as some expenses (commuting, work clothes) decrease, 
                        but others (healthcare, leisure) may increase.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="retirementIncome"
                    type="number"
                    value={retirementIncomePercent}
                    onChange={(e) => setRetirementIncomePercent(e.target.value)}
                    placeholder="75"
                    min="1"
                    max="100"
                    step="1"
                  />
                  <p className="text-xs text-muted-foreground">
                    Percentage of current income needed in retirement (default: 75%)
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="withdrawalRate">Safe Withdrawal Rate (%)</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        The percentage of your retirement portfolio you can safely withdraw each year without 
                        running out of money. The "4% rule" is a common guideline suggesting that withdrawing 
                        4% annually (adjusted for inflation) should sustain a portfolio for 30+ years.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="withdrawalRate"
                    type="number"
                    value={safeWithdrawalRate}
                    onChange={(e) => setSafeWithdrawalRate(e.target.value)}
                    placeholder="4"
                    min="1"
                    max="10"
                    step="0.1"
                  />
                  <p className="text-xs text-muted-foreground">
                    Annual withdrawal rate during retirement (default: 4%)
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="salaryGrowth">Annual Salary Growth (%)</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        The expected annual increase in your salary. This accounts for promotions, raises, and 
                        career progression. A typical rate is 2-3% per year, though this can vary significantly 
                        based on your career stage and industry.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="salaryGrowth"
                    type="number"
                    value={salaryGrowth}
                    onChange={(e) => setSalaryGrowth(e.target.value)}
                    placeholder="2"
                    min="0"
                    max="20"
                    step="0.1"
                  />
                  <p className="text-xs text-muted-foreground">
                    Expected annual salary increase (default: 2%)
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="lowestRisk">Use Lowest Risk Investment Vehicle Post-Retirement</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          In retirement, most investors shift to lower-risk investments to preserve capital. 
                          When enabled, your portfolio will automatically switch to the Very Low Risk vehicle (4% return) 
                          during retirement. Toggle off to choose a different investment vehicle.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Automatically use Very Low Risk (4%) vehicle in retirement
                    </p>
                  </div>
                  <Switch
                    id="lowestRisk"
                    checked={useLowestRiskPostRetirement}
                    onCheckedChange={setUseLowestRiskPostRetirement}
                  />
                </div>

                {!useLowestRiskPostRetirement && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="postRetirementVehicle">Post-Retirement Investment Vehicle Return</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          The expected annual return rate during retirement. Choose the investment vehicle 
                          that matches your risk tolerance during retirement years.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Select value={postRetirementVehicle} onValueChange={setPostRetirementVehicle}>
                      <SelectTrigger id="postRetirementVehicle">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {investmentVehicles.map((vehicle, index) => (
                          <SelectItem key={index} value={index.toString()}>
                            {vehicle.name} - {vehicle.returnRate}%
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Investment return rate during retirement years
                    </p>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Button onClick={calculateRetirement} className="w-full mt-6">
            <Calculator className="mr-2 h-4 w-4" />
            Calculate Retirement Plan
          </Button>
        </CardContent>
      </Card>

      {results && (
        <RetirementResults 
          results={results} 
          inputs={{
            currentAge: parseInt(currentAge),
            retirementAge: parseInt(retirementAge),
            currentIncome: parseFloat(currentIncome),
            investmentVehicle: investmentVehicles[parseInt(selectedVehicle)],
            replacementRatio: parseFloat(retirementIncomePercent) / 100,
            safeWithdrawalRate: parseFloat(safeWithdrawalRate) / 100
          }}
        />
      )}
    </div>
  );
}
