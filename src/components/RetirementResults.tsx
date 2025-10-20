import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, ReferenceLine } from 'recharts';
import { TrendingUp, DollarSign, Calendar, PiggyBank, Info, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { SequenceRiskVisualization } from './SequenceRiskVisualization';
import type { CalculationResults, CalculationInputs, MonteCarloProjection } from './RetirementCalculator';

interface RetirementResultsProps {
  results: CalculationResults;
  inputs: CalculationInputs;
}

// UK Tax calculation function for 2024/2025
function calculateUKTax(grossIncome: number) {
  const personalAllowance = 12570;
  const basicRateThreshold = 50270;
  const higherRateThreshold = 125140;
  
  let incomeTax = 0;
  let taxableIncome = grossIncome;
  
  // Personal allowance tapers at £100,000
  let effectivePersonalAllowance = personalAllowance;
  if (grossIncome > 100000) {
    const reduction = (grossIncome - 100000) / 2;
    effectivePersonalAllowance = Math.max(0, personalAllowance - reduction);
  }
  
  taxableIncome = Math.max(0, grossIncome - effectivePersonalAllowance);
  
  // Calculate income tax
  if (taxableIncome <= basicRateThreshold - personalAllowance) {
    incomeTax = taxableIncome * 0.20;
  } else if (taxableIncome <= higherRateThreshold - personalAllowance) {
    incomeTax = (basicRateThreshold - personalAllowance) * 0.20 + 
                (taxableIncome - (basicRateThreshold - personalAllowance)) * 0.40;
  } else {
    incomeTax = (basicRateThreshold - personalAllowance) * 0.20 + 
                (higherRateThreshold - basicRateThreshold) * 0.40 +
                (taxableIncome - (higherRateThreshold - personalAllowance)) * 0.45;
  }
  
  // National Insurance (Employee's contribution)
  let nationalInsurance = 0;
  const niLowerThreshold = 12570;
  const niUpperThreshold = 50270;
  
  if (grossIncome > niLowerThreshold) {
    if (grossIncome <= niUpperThreshold) {
      nationalInsurance = (grossIncome - niLowerThreshold) * 0.12;
    } else {
      nationalInsurance = (niUpperThreshold - niLowerThreshold) * 0.12 +
                         (grossIncome - niUpperThreshold) * 0.02;
    }
  }
  
  return incomeTax + nationalInsurance;
}

export function RetirementResults({ results, inputs }: RetirementResultsProps) {
  const formatCurrency = (value: number) => {
    if (!isFinite(value) || isNaN(value)) {
      return '£0';
    }
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatAxisValue = (value: number) => {
    if (!isFinite(value) || isNaN(value)) {
      return '£0';
    }
    if (value >= 1000000) {
      return `£${(value / 1000000).toFixed(1)}m`;
    }
    return `£${(value / 1000).toFixed(0)}k`;
  };

  const formatPercent = (value: number) => {
    if (!isFinite(value) || isNaN(value)) {
      return '0%';
    }
    return `${value.toFixed(1)}%`;
  };

  // Calculate UK tax breakdown
  const totalTax = calculateUKTax(inputs.currentIncome);
  const retirementSavings = results.annualInvestmentNeeded;
  const disposableIncome = inputs.currentIncome - totalTax - retirementSavings;

  const salaryBreakdown = [
    { name: 'Tax & NI', value: isFinite(totalTax) ? totalTax : 0 },
    { name: 'Retirement Savings', value: isFinite(retirementSavings) ? retirementSavings : 0 },
    { name: 'Disposable Income', value: isFinite(disposableIncome) ? Math.max(0, disposableIncome) : 0 }
  ];

  // Prepare chart data
  const growthChartData = results.yearlyProjections.map(p => ({
    year: p.year,
    'Contributions': Math.round(p.cumulativeContribution),
    'Returns': Math.round(p.investmentReturns),
    'Total Value': Math.round(p.totalValue),
  }));

  const postRetirementChartData = results.postRetirementProjections.map(p => ({
    year: p.year,
    age: p.age,
    'Portfolio Value': Math.round(p.portfolioValue),
    'Withdrawal': Math.round(p.withdrawal),
  }));

  const contributionsVsReturns = [
    { name: 'Your Contributions', value: results.totalContributions },
    { name: 'Investment Returns', value: results.totalReturns }
  ];

  const COLORS = ['#0088FE', '#00C49F'];
  const SALARY_COLORS = ['#EF4444', '#8B5CF6', '#10B981'];

  const returnsPercentage = (results.totalReturns / (results.totalReturns + results.totalContributions)) * 100;

  // Calculate age milestones
  const milestones = [];
  for (let age = inputs.currentAge + 5; age < inputs.retirementAge; age += 5) {
    const yearsFromNow = age - inputs.currentAge;
    const projection = results.yearlyProjections[yearsFromNow];
    if (projection && isFinite(projection.totalValue)) {
      milestones.push({
        age,
        value: projection.totalValue
      });
    }
  }
  // Add retirement age milestone
  if (isFinite(results.targetRetirementCorpus)) {
    milestones.push({
      age: inputs.retirementAge,
      value: results.targetRetirementCorpus
    });
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Monthly Investment Needed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${results.isUnrealistic ? 'text-red-600' : ''}`}>
              {formatCurrency(results.monthlyInvestmentNeeded)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(results.annualInvestmentNeeded)} annually
            </p>
            {results.isUnrealistic && (
              <div className="flex items-center gap-1 mt-2 text-red-600 text-xs">
                <AlertTriangle className="h-3 w-3" />
                <span>{results.incomePercentageNeeded.toFixed(1)}% of income needed</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <PiggyBank className="h-4 w-4" />
              Target Retirement Savings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(results.targetRetirementCorpus)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              At age {inputs.retirementAge}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Time Horizon
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{results.yearsUntilRetirement} Years</div>
            <p className="text-xs text-muted-foreground mt-1">
              Until retirement
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Expected Returns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(results.totalReturns)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatPercent(returnsPercentage)} of total value
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Investment Summary</CardTitle>
          <CardDescription>Overview of your retirement investment plan</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pre-Retirement Investment:</span>
                <div className="flex items-center gap-2">
                  <span>{inputs.investmentVehicle.name}</span>
                  <Badge variant="secondary">{inputs.investmentVehicle.riskLevel}</Badge>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pre-Retirement Return Rate:</span>
                <span>{formatPercent(inputs.investmentVehicle.returnRate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Post-Retirement Investment:</span>
                <div className="flex items-center gap-2">
                  <span>{results.postRetirementVehicle.name}</span>
                  <Badge variant="secondary">{results.postRetirementVehicle.riskLevel}</Badge>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Post-Retirement Return Rate:</span>
                <span>{formatPercent(results.postRetirementVehicle.returnRate)}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Contributions:</span>
                <span>{formatCurrency(results.totalContributions)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Investment Returns:</span>
                <span className="text-green-600">{formatCurrency(results.totalReturns)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Final Portfolio Value:</span>
                <span>{formatCurrency(results.totalContributions + results.totalReturns)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Return on Investment:</span>
                <span className="text-green-600">{formatPercent((results.totalReturns / results.totalContributions) * 100)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visualizations */}
      <Tabs defaultValue="growth" className="w-full">
        <TabsList className={`grid w-full ${results.monteCarloProjections ? 'grid-cols-5' : 'grid-cols-3'}`}>
          <TabsTrigger value="growth">Portfolio Growth</TabsTrigger>
          {results.monteCarloProjections && (
            <>
              <TabsTrigger value="montecarlo">Monte Carlo</TabsTrigger>
              <TabsTrigger value="sequence">Sequence Risk</TabsTrigger>
            </>
          )}
          <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
          <TabsTrigger value="projections">Year-by-Year</TabsTrigger>
        </TabsList>

        <TabsContent value="growth" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Portfolio Growth Projection</CardTitle>
              <CardDescription>
                How your investment will grow over {results.yearsUntilRetirement} years
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={growthChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis 
                    tickFormatter={formatAxisValue}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => [formatCurrency(value), name]}
                    labelStyle={{ color: '#000' }}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="Contributions" 
                    stackId="1"
                    stroke="#0088FE" 
                    fill="#0088FE" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="Returns" 
                    stackId="1"
                    stroke="#00C49F" 
                    fill="#00C49F" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Portfolio Value Post-Retirement</CardTitle>
              <CardDescription>
                How your portfolio evolves during {results.retirementDuration} years of retirement
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={postRetirementChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis 
                    tickFormatter={formatAxisValue}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => [formatCurrency(value), name]}
                    labelStyle={{ color: '#000' }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="Portfolio Value" 
                    stroke="#8884d8" 
                    strokeWidth={3}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {results.monteCarloProjections && (
          <TabsContent value="montecarlo" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Monte Carlo Simulation - Range of Possible Outcomes</CardTitle>
                <CardDescription>
                  1,000 simulations showing how market volatility affects your retirement portfolio
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert className="mb-4">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Traditional calculators assume constant returns every year (e.g., exactly {inputs.investmentVehicle.returnRate}% annually). 
                    In reality, markets fluctuate dramatically - some years deliver +30%, others -20%. This Monte Carlo simulation 
                    runs 1,000 scenarios with realistic market volatility to show the range of possible outcomes. 
                    <strong className="block mt-2">💡 Check the "Sequence Risk" tab to see why the timing of these returns matters as much as the average!</strong>
                  </AlertDescription>
                </Alert>
                <ResponsiveContainer width="100%" height={450}>
                  <ComposedChart data={results.monteCarloProjections} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorP90" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#86efac" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#86efac" stopOpacity={0.1}/>
                      </linearGradient>
                      <linearGradient id="colorP75" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.6}/>
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0.3}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="year" stroke="#6b7280" />
                    <YAxis tickFormatter={formatAxisValue} stroke="#6b7280" />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      labelStyle={{ color: '#000' }}
                      contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #e5e7eb' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    
                    {/* Light green band: 10th-90th percentile (possible range) */}
                    <Area 
                      type="monotone" 
                      dataKey="p90" 
                      stroke="#86efac"
                      strokeWidth={1}
                      fill="url(#colorP90)" 
                      name="Possible Range (10th-90th)"
                      legendType="rect"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="p10" 
                      stroke="none"
                      fill="#fff" 
                      fillOpacity={1}
                      legendType="none"
                    />
                    
                    {/* Dark green band: 25th-75th percentile (likely range) */}
                    <Area 
                      type="monotone" 
                      dataKey="p75" 
                      stroke="#22c55e"
                      strokeWidth={1}
                      fill="url(#colorP75)" 
                      name="Likely Range (25th-75th)"
                      legendType="rect"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="p25" 
                      stroke="none"
                      fill="#fff" 
                      fillOpacity={1}
                      legendType="none"
                    />
                    
                    {/* Median line */}
                    <Line 
                      type="monotone" 
                      dataKey="p50" 
                      stroke="#16a34a" 
                      strokeWidth={3}
                      dot={false}
                      name="Median (50th)"
                    />
                    
                    {/* Target line (dotted) */}
                    <Line 
                      type="monotone" 
                      dataKey="target" 
                      stroke="#3b82f6" 
                      strokeWidth={3}
                      strokeDasharray="5 5"
                      dot={false}
                      name="Target Amount"
                    />
                    
                    {/* Deterministic trajectory (red line) */}
                    <Line 
                      type="monotone" 
                      dataKey="deterministic" 
                      stroke="#ef4444" 
                      strokeWidth={3}
                      dot={false}
                      name="Without Risk Adjustment"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2 text-sm">
                  <p className="flex items-center gap-2">
                    <span className="w-4 h-4 bg-[#22c55e] opacity-50 rounded"></span>
                    <span><span className="font-medium">Dark green band:</span> 25th-75th percentile (likely range - 50% of outcomes fall here)</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="w-4 h-4 bg-[#86efac] opacity-30 rounded"></span>
                    <span><span className="font-medium">Light green band:</span> 10th-90th percentile (possible range - 80% of outcomes fall here)</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="w-4 h-0.5 bg-[#16a34a] rounded"></span>
                    <span><span className="font-medium">Green line:</span> Median outcome (50th percentile)</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="w-4 h-0.5 bg-[#3b82f6] rounded" style={{ borderTop: '2px dashed #3b82f6', background: 'none' }}></span>
                    <span><span className="font-medium">Blue dashed line:</span> Your target retirement amount</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="w-4 h-0.5 bg-[#ef4444] rounded"></span>
                    <span><span className="font-medium">Red line:</span> Traditional calculation assuming constant {inputs.investmentVehicle.returnRate}% returns</span>
                  </p>
                </div>
                
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardDescription>Best Case Scenario (90th percentile)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">
                        {formatCurrency(results.monteCarloProjections[results.monteCarloProjections.length - 1].p90)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Only 10% of simulations did better
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardDescription>Worst Case Scenario (10th percentile)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-orange-600">
                        {formatCurrency(results.monteCarloProjections[results.monteCarloProjections.length - 1].p10)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        90% of simulations did better
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardDescription>Median Outcome (50th percentile)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatCurrency(results.monteCarloProjections[results.monteCarloProjections.length - 1].p50)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Half of simulations did better, half did worse
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardDescription>Success Rate</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-blue-600">
                        {((results.monteCarloProjections[results.monteCarloProjections.length - 1].p50 >= results.targetRetirementCorpus) ? '~50%+' : '~50%-')}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Estimated chance of meeting your target
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {results.sequenceProjections && results.sequenceScenarios && (
          <TabsContent value="sequence">
            <SequenceRiskVisualization
              scenarios={results.sequenceScenarios}
              projections={results.sequenceProjections}
              retirementAge={inputs.retirementAge}
              retirementDuration={results.retirementDuration}
              expectedReturn={inputs.investmentVehicle.returnRate}
              postRetirementVehicle={results.postRetirementVehicle}
            />
          </TabsContent>
        )}

        <TabsContent value="breakdown" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Contributions vs Returns</CardTitle>
                <CardDescription>
                  Breakdown of your final portfolio value
                </CardDescription>
              </CardHeader>
              <CardContent className="rounded-[4px]">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={contributionsVsReturns}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {contributionsVsReturns.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Annual Salary Breakdown (Current Year)</CardTitle>
                <CardDescription>
                  How your current income is allocated
                </CardDescription>
              </CardHeader>
              <CardContent>
                {results.isUnrealistic ? (
                  <div className="flex flex-col items-center justify-center h-[300px] text-center space-y-4">
                    <AlertTriangle className="h-16 w-16 text-red-600" />
                    <div className="space-y-2">
                      <h3 className="font-semibold text-red-600">Unrealistic Retirement Plan</h3>
                      <p className="text-sm text-muted-foreground max-w-md">
                        This retirement plan requires {results.incomePercentageNeeded.toFixed(1)}% of your current income, 
                        which is not sustainable. Consider adjusting your retirement age, reducing retirement income needs, 
                        or choosing a higher-return investment vehicle.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={salaryBreakdown}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {salaryBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={SALARY_COLORS[index % SALARY_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SALARY_COLORS[0] }}></div>
                          Tax & NI
                        </span>
                        <span>{formatCurrency(totalTax)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SALARY_COLORS[1] }}></div>
                          Retirement Savings
                        </span>
                        <span>{formatCurrency(retirementSavings)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SALARY_COLORS[2] }}></div>
                          Disposable Income
                        </span>
                        <span>{formatCurrency(disposableIncome)}</span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Age Milestones</CardTitle>
                <CardDescription>
                  Portfolio value at key ages
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute top-8 left-0 right-0 h-1 bg-gradient-to-r from-blue-200 via-purple-200 to-green-200"></div>
                  
                  {/* Milestones */}
                  <div className="relative flex justify-between items-start pt-1">
                    {milestones.map((milestone, index) => {
                      const isRetirement = milestone.age === inputs.retirementAge;
                      const isFirst = index === 0;
                      const isLast = index === milestones.length - 1;
                      
                      return (
                        <div key={index} className="flex flex-col items-center" style={{ width: `${100 / milestones.length}%` }}>
                          {/* Dot */}
                          <div className={`relative z-10 rounded-full flex items-center justify-center transition-all ${
                            isRetirement 
                              ? 'h-16 w-16 bg-gradient-to-br from-green-400 to-emerald-600 shadow-lg shadow-green-500/50' 
                              : 'h-12 w-12 bg-gradient-to-br from-blue-400 to-purple-600 shadow-md'
                          }`}>
                            <span className={`font-bold text-white ${isRetirement ? 'text-lg' : 'text-sm'}`}>
                              {milestone.age}
                            </span>
                          </div>
                          
                          {/* Label */}
                          <div className="mt-3 text-center">
                            <p className={`text-xs text-muted-foreground mb-1 ${isRetirement ? 'font-semibold' : ''}`}>
                              {isRetirement ? '🎉 Retirement' : `Age ${milestone.age}`}
                            </p>
                            <p className={`font-bold ${isRetirement ? 'text-base text-green-600' : 'text-sm'}`}>
                              {formatCurrency(milestone.value)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="projections">
          <Card>
            <CardHeader>
              <CardTitle>Year-by-Year Projections</CardTitle>
              <CardDescription>
                Detailed breakdown of your investment growth over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Year</TableHead>
                      <TableHead>Age</TableHead>
                      <TableHead className="text-right">Annual Contribution</TableHead>
                      <TableHead className="text-right">Total Contributions</TableHead>
                      <TableHead className="text-right">Investment Returns</TableHead>
                      <TableHead className="text-right">Portfolio Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.yearlyProjections.map((projection, index) => (
                      <TableRow key={index}>
                        <TableCell>{projection.year}</TableCell>
                        <TableCell>{projection.age}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(projection.annualContribution)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(projection.cumulativeContribution)}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {formatCurrency(projection.investmentReturns)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(projection.totalValue)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
