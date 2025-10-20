import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea, ReferenceLine, BarChart, Bar } from 'recharts';
import { AlertTriangle, Info, TrendingDown, TrendingUp, TrendingUp as TrendingUpIcon } from 'lucide-react';
import type { SequenceScenario, SequenceProjection, InvestmentVehicle } from './RetirementCalculator';

interface SequenceRiskVisualizationProps {
  scenarios: SequenceScenario[];
  projections: SequenceProjection[];
  retirementAge: number;
  retirementDuration: number;
  expectedReturn: number;
  postRetirementVehicle: InvestmentVehicle;
}

export function SequenceRiskVisualization({ 
  scenarios, 
  projections, 
  retirementAge,
  retirementDuration,
  expectedReturn,
  postRetirementVehicle
}: SequenceRiskVisualizationProps) {
  
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

  // Create return sequence visualization data using actual scenario returns
  const createReturnSequenceData = () => {
    const data = [];
    const retirementYearIndex = projections.findIndex(p => p.isRetirementYear);
    const displayYears = retirementYearIndex + Math.min(10, retirementDuration);
    
    // Get actual return sequences from scenarios
    const bullScenario = scenarios[0]; // Bull into retirement
    const bearScenario = scenarios[1]; // Bear into retirement
    const avgScenario = scenarios[3];  // Steady average
    
    for (let i = 0; i < displayYears; i++) {
      const proj = projections[i];
      const isPreRetirement = i < retirementYearIndex;
      
      // Get actual returns from the scenario sequences
      let bullReturn, bearReturn, avgReturn;
      
      if (isPreRetirement) {
        // Use pre-retirement sequences
        bullReturn = bullScenario.preRetirement[i] * 100;
        bearReturn = bearScenario.preRetirement[i] * 100;
        avgReturn = avgScenario.preRetirement[i] * 100;
      } else {
        // Use post-retirement sequences
        const postRetIndex = i - retirementYearIndex;
        bullReturn = bullScenario.postRetirement[postRetIndex] * 100;
        bearReturn = bearScenario.postRetirement[postRetIndex] * 100;
        avgReturn = avgScenario.postRetirement[postRetIndex] * 100;
      }
      
      data.push({
        year: proj.year,
        age: proj.age,
        phase: isPreRetirement ? 'Accumulation' : 'Retirement',
        isCriticalZone: proj.isCriticalZone,
        bullReturns: bullReturn,
        bearReturns: bearReturn,
        avgReturns: avgReturn
      });
    }
    
    return data;
  };

  const returnSequenceData = createReturnSequenceData();
  const retirementYear = projections.find(p => p.isRetirementYear)?.year || 0;

  // Calculate portfolio values at retirement for analysis
  const retirementProjection = projections.find(p => p.isRetirementYear);
  const retirementAnalysis = retirementProjection ? [
    {
      name: 'Bull Into Retirement',
      value: retirementProjection.bestCase,
      color: scenarios[0].color,
      icon: TrendingUpIcon
    },
    {
      name: 'Bear Into Retirement',
      value: retirementProjection.worstCase,
      color: scenarios[1].color,
      icon: TrendingDown
    },
    {
      name: 'Steady Average',
      value: retirementProjection.average,
      color: scenarios[3].color,
      icon: Info
    }
  ] : [];

  // Calculate percentage differences from steady average
  const steadyAverageValue = retirementProjection?.average || 0;
  const bullDifference = steadyAverageValue > 0 
    ? ((retirementProjection?.bestCase || 0) - steadyAverageValue) / steadyAverageValue * 100 
    : 0;
  const bearDifference = steadyAverageValue > 0 
    ? ((retirementProjection?.worstCase || 0) - steadyAverageValue) / steadyAverageValue * 100 
    : 0;

  return (
    <div className="space-y-6">
      {/* Investment Strategy Summary */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Pre-Retirement Strategy</p>
              <p className="font-semibold text-lg">{scenarios[0].preRetirementReturnRate}% Expected Return</p>
              <p className="text-xs text-muted-foreground mt-1">During accumulation phase (varies by scenario)</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Post-Retirement Strategy</p>
              <p className="font-semibold text-lg">{scenarios[0].postRetirementReturnRate}% Steady Return</p>
              <p className="text-xs text-muted-foreground mt-1">During withdrawal phase (same for all scenarios)</p>
              {scenarios[0].preRetirementReturnRate !== scenarios[0].postRetirementReturnRate && (
                <Badge className="mt-2" variant="outline">De-risked & Conservative</Badge>
              )}
            </div>
          </div>
          <div className="mt-4 p-3 bg-white rounded-lg border border-blue-300">
            <p className="text-sm text-blue-900">
              <strong>Note:</strong> All scenarios use your selected conservative post-retirement vehicle ({scenarios[0].postRetirementReturnRate}%) 
              with steady returns. The difference between scenarios is entirely in the <strong>pre-retirement phase</strong>, 
              demonstrating how the timing of returns before retirement affects your final outcome.
            </p>
          </div>
        </CardContent>
      </Card>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Critical Insight: Same Average Returns, Wildly Different Outcomes</AlertTitle>
        <AlertDescription className="mt-2 space-y-3">
          <div className="bg-white p-3 rounded-lg border-l-4 border-blue-500">
            <p className="font-semibold text-blue-900 mb-2">🎯 The Setup:</p>
            <p>
              All scenarios below use <strong>identical average returns</strong>: 
              {scenarios[0].preRetirementReturnRate}% before retirement, {scenarios[0].postRetirementReturnRate}% after retirement. 
              The <strong>only difference is WHEN those returns occur</strong>.
            </p>
          </div>
          
          <div className="bg-green-50 p-3 rounded-lg border-l-4 border-green-500">
            <p className="font-semibold text-green-900 mb-2">✅ Good News About Early Losses:</p>
            <p>
              Market crashes early in your career are less damaging because you have <strong>decades of contributions ahead</strong> to buy 
              assets at low prices and benefit from recovery.
            </p>
          </div>
          
          <div className="bg-red-50 p-3 rounded-lg border-l-4 border-red-500">
            <p className="font-semibold text-red-900 mb-2">⚠️ Danger of Late Losses:</p>
            <p>
              Market crashes near or during retirement are <strong>devastating</strong> because you're withdrawing money during the downturn, 
              permanently depleting your portfolio. There's no time or new contributions to recover.
            </p>
          </div>

          <div className="bg-yellow-50 p-3 rounded-lg border-l-4 border-yellow-500">
            <p className="font-semibold text-yellow-900 mb-2">🎯 The Critical 5-Year Window:</p>
            <p>
              The <strong>5 years immediately before retirement</strong> (shown in yellow on charts) have the biggest impact. 
              A bear market at age {retirementAge - 1} can ruin a retirement plan, while the same bear market at age 25 barely matters.
            </p>
          </div>

          {scenarios[0].preRetirementReturnRate !== scenarios[0].postRetirementReturnRate && (
            <div className="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-500">
              <p className="font-semibold text-blue-900 mb-2">🛡️ Your De-Risking Strategy:</p>
              <p>
                You've wisely chosen to reduce risk in retirement: shifting from {scenarios[0].preRetirementReturnRate}% expected returns 
                to steady {scenarios[0].postRetirementReturnRate}% returns in retirement. All scenarios below use the same conservative post-retirement returns, 
                demonstrating that sequence risk is primarily about what happens BEFORE you retire.
              </p>
            </div>
          )}
        </AlertDescription>
      </Alert>

      {/* Return Sequence Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Chart 1: Annual Returns Over Time</CardTitle>
          <CardDescription>
            This chart shows the actual year-by-year returns for each scenario. Notice how the green and red bars have opposite patterns, 
            but both average out to the same return rate over the full period.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={returnSequenceData} margin={{ top: 20, right: 30, left: 70, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="year" 
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                label={{ 
                  value: 'Annual Return (%)', 
                  angle: -90, 
                  position: 'center',
                  offset: 10,
                  style: { textAnchor: 'middle' }
                }}
                width={60}
              />
              
              {/* Highlight critical zone */}
              {returnSequenceData.map((data, idx) => {
                if (data.isCriticalZone && idx > 0) {
                  const prevData = returnSequenceData[idx - 1];
                  if (!prevData.isCriticalZone) {
                    return (
                      <ReferenceArea
                        key={`critical-${idx}`}
                        x1={data.year}
                        x2={returnSequenceData.find((d, i) => i > idx && !d.isCriticalZone)?.year || data.year}
                        fill="#fef3c7"
                        fillOpacity={0.6}
                      />
                    );
                  }
                }
                return null;
              })}
              
              <ReferenceLine 
                x={retirementYear} 
                stroke="#ef4444" 
                strokeWidth={2}
                strokeDasharray="5 5"
                label={{ 
                  value: 'Retirement', 
                  position: 'top', 
                  fill: '#ef4444',
                  fontSize: 12
                }}
              />
              
              <Tooltip 
                formatter={(value: number) => `${value.toFixed(1)}%`}
                labelFormatter={(label) => `Year: ${label}`}
              />
              <Legend 
                verticalAlign="top"
                height={36}
                wrapperStyle={{ paddingBottom: '10px' }}
              />
              
              <Bar dataKey="bullReturns" fill="#22c55e" name="Bull Into Retirement" />
              <Bar dataKey="bearReturns" fill="#ef4444" name="Bear Into Retirement" />
              <Bar dataKey="avgReturns" fill="#3b82f6" fillOpacity={0.3} name="Average Returns" />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-3">
            <p className="text-sm font-semibold">How to Read This Chart:</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="flex items-start gap-2 p-3 bg-green-50 rounded-lg border-2 border-green-300">
                <TrendingUp className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-green-900">🟢 Bull Into Retirement</p>
                  <p className="text-xs text-green-700 mt-1">Returns start low, end high. You enter retirement with a large portfolio.</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg border-2 border-red-300">
                <TrendingDown className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-red-900">🔴 Bear Into Retirement</p>
                  <p className="text-xs text-red-700 mt-1">Returns start high, end low. You enter retirement with a smaller portfolio.</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg border-2 border-yellow-400">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-yellow-900">🟡 Critical Zone</p>
                  <p className="text-xs text-yellow-700 mt-1">5 years before retirement. Performance here matters most.</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-300">
              <div className="w-12 h-1 bg-blue-400 opacity-50"></div>
              <p className="text-xs text-blue-700">
                <strong>Blue (semi-transparent):</strong> Steady average returns every year - baseline for comparison
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Portfolio Value Over Time */}
      <Card>
        <CardHeader>
          <CardTitle>Chart 2: Portfolio Value Throughout Life</CardTitle>
          <CardDescription>
            This chart shows how your portfolio grows and then depletes during retirement. The same annual returns from Chart 1, 
            applied in different sequences, produce dramatically different portfolio values - especially during the critical yellow zone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={500}>
            <LineChart data={projections} margin={{ top: 60, right: 30, left: 80, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="year" 
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                tickFormatter={formatAxisValue}
                label={{ 
                  value: 'Portfolio Value (£)', 
                  angle: -90, 
                  position: 'center',
                  offset: 10,
                  style: { textAnchor: 'middle' }
                }}
                width={70}
                domain={[0, 'auto']}
              />
              
              {/* Critical zone highlighting */}
              {projections.map((proj, idx) => {
                if (proj.isCriticalZone && idx > 0) {
                  const prevProj = projections[idx - 1];
                  if (!prevProj.isCriticalZone) {
                    return (
                      <ReferenceArea
                        key={`critical-${idx}`}
                        x1={proj.year}
                        x2={projections.find((p, i) => i > idx && !p.isCriticalZone)?.year || proj.year}
                        fill="#fef3c7"
                        fillOpacity={0.5}
                      />
                    );
                  }
                }
                return null;
              })}
              
              {/* Retirement line */}
              <ReferenceLine 
                x={projections.find(p => p.isRetirementYear)?.year} 
                stroke="#ef4444" 
                strokeWidth={2}
                strokeDasharray="5 5"
                label={{ value: 'Retirement', position: 'top', fill: '#ef4444', fontWeight: 'bold' }}
              />
              
              <Tooltip 
                formatter={(value: number, name: string) => [formatCurrency(value), name]}
                labelFormatter={(label) => `Year: ${label}`}
              />
              <Legend 
                verticalAlign="top"
                height={36}
                wrapperStyle={{ paddingTop: '0px', paddingBottom: '15px' }}
              />
              
              <Line 
                type="monotone" 
                dataKey="bestCase" 
                stroke={scenarios[0].color}
                strokeWidth={3}
                dot={false}
                name="Bull Into Retirement"
              />
              <Line 
                type="monotone" 
                dataKey="worstCase" 
                stroke={scenarios[1].color}
                strokeWidth={3}
                dot={false}
                name="Bear Into Retirement"
              />
              <Line 
                type="monotone" 
                dataKey="average" 
                stroke={scenarios[3].color}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                name="Steady Average"
              />
            </LineChart>
          </ResponsiveContainer>

          {/* Portfolio Values at Retirement Analysis */}
          {retirementProjection && (
            <div className="mt-6 space-y-4">
              <div className="border-t pt-4">
                <h4 className="font-semibold text-lg mb-3">Portfolio Value at Retirement (Age {retirementAge})</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Despite identical average returns, the timing of those returns creates dramatically different outcomes:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {retirementAnalysis.map((item, idx) => {
                    const Icon = item.icon;
                    const diffPercent = item.name === 'Bull Into Retirement' 
                      ? bullDifference 
                      : item.name === 'Bear Into Retirement' 
                        ? bearDifference 
                        : 0;
                    const diffAmount = item.value - steadyAverageValue;
                    
                    return (
                      <Card key={idx} className="border-2" style={{ borderColor: item.color }}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between mb-2">
                            <Icon className="h-5 w-5" style={{ color: item.color }} />
                            <Badge variant="outline" style={{ borderColor: item.color, color: item.color }}>
                              {item.name}
                            </Badge>
                          </div>
                          <div className="text-2xl font-bold mb-2" style={{ color: item.color }}>
                            {formatCurrency(item.value)}
                          </div>
                          {item.name !== 'Steady Average' && (
                            <div className={`text-sm ${diffPercent > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              <div className="font-semibold">
                                {diffPercent > 0 ? '+' : ''}{diffPercent.toFixed(1)}% vs Average
                              </div>
                              <div className="text-xs">
                                {diffPercent > 0 ? '+' : ''}{formatCurrency(diffAmount)}
                              </div>
                            </div>
                          )}
                          {item.name === 'Steady Average' && (
                            <div className="text-sm text-muted-foreground">
                              Baseline scenario
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Insightful Analysis */}
                <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200">
                  <h5 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Key Insights
                  </h5>
                  <div className="space-y-2 text-sm text-gray-700">
                    <p>
                      <strong className="text-green-700">Bull scenario advantage:</strong> Entering retirement with {formatCurrency(retirementProjection.bestCase)} 
                      ({bullDifference > 0 ? '+' : ''}{bullDifference.toFixed(1)}% more than average) provides a substantial safety cushion. 
                      {bullDifference > 15 && ' This dramatic difference shows how critical late-career returns are.'}
                    </p>
                    <p>
                      <strong className="text-red-700">Bear scenario risk:</strong> Starting retirement with only {formatCurrency(retirementProjection.worstCase)} 
                      ({bearDifference.toFixed(1)}% less than average) significantly increases the risk of running out of money. 
                      {Math.abs(bearDifference) > 15 && ' This gap would be nearly impossible to recover from during retirement.'}
                    </p>
                    <p>
                      <strong className="text-blue-700">Impact magnitude:</strong> The difference between best and worst case is {formatCurrency(Math.abs(retirementProjection.bestCase - retirementProjection.worstCase))} 
                      ({(Math.abs(bullDifference - bearDifference)).toFixed(1)} percentage points), 
                      showing that sequence risk can be more important than investment selection.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 space-y-3">
            <p className="text-sm font-semibold">How to Read This Chart:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 bg-yellow-50 rounded-lg border-2 border-yellow-400">
                <p className="text-sm font-semibold text-yellow-900 mb-1">🟡 Yellow Background Zone</p>
                <p className="text-xs text-yellow-700">
                  The critical 5-year window before retirement. Your portfolio is most vulnerable to sequence risk here.
                </p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg border border-red-300">
                <p className="text-sm font-semibold text-red-900 mb-1">🔴 Red Dashed Line</p>
                <p className="text-xs text-red-700">
                  Your retirement date. Before this: you're contributing. After this: you're withdrawing.
                </p>
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-300">
              <p className="text-sm font-semibold mb-2">Line Colors Represent Different Return Sequences:</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-1 bg-green-500"></div>
                  <span>Bull Into Retirement (best case)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-1 bg-red-500"></div>
                  <span>Bear Into Retirement (worst case)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-1 bg-blue-500 opacity-50" style={{ borderTop: '1px dashed #3b82f6' }}></div>
                  <span>Steady Average (baseline)</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scenario Outcomes - Filter out the Early Bear, Late Bull scenario */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {scenarios.filter((_, idx) => idx !== 2).map((scenario, idx) => {
          const isSuccess = scenario.survivalYears >= retirementDuration;
          // Map filtered index back to original scenario for correct data
          const originalIdx = idx < 2 ? idx : 3;
          return (
            <Card key={originalIdx} className="border-2" style={{ borderColor: scenario.color }}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base" style={{ color: scenario.color }}>
                      {scenario.name}
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">
                      {scenario.description}
                    </CardDescription>
                  </div>
                  {!isSuccess && (
                    <Badge variant="destructive" className="ml-2">
                      Failed
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Final Portfolio Value</p>
                  <p className="text-xl font-bold" style={{ color: scenario.color }}>
                    {formatCurrency(scenario.finalValue)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Portfolio Survival</p>
                  <p className={`text-lg font-semibold ${isSuccess ? 'text-green-600' : 'text-red-600'}`}>
                    {isSuccess 
                      ? `✓ Full ${retirementDuration} years` 
                      : `✗ Only ${scenario.survivalYears} years`
                    }
                  </p>
                </div>
                {!isSuccess && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertDescription className="text-xs">
                      Portfolio depleted {retirementDuration - scenario.survivalYears} years early
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Summary Explanation */}
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600" />
            What These Charts Tell You
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-lg border border-blue-200">
              <p className="font-semibold text-blue-900 mb-2">📊 Chart 1 shows WHEN returns happen:</p>
              <p className="text-sm text-gray-700">
                Green bars start low and climb high (bull market into retirement). 
                Red bars start high and drop low (bear market into retirement). 
                Both average to {scenarios[0].preRetirementReturnRate}% pre-retirement. After retirement, all scenarios use steady {scenarios[0].postRetirementReturnRate}% returns (your chosen conservative vehicle).
              </p>
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-blue-200">
              <p className="font-semibold text-blue-900 mb-2">📈 Chart 2 shows WHY it matters:</p>
              <p className="text-sm text-gray-700">
                The green line (good returns late) produces a much larger retirement portfolio than the red line (bad returns late), 
                even though they have the same average return. Timing is everything.
              </p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border-2 border-yellow-400">
            <p className="font-semibold text-gray-900 mb-3">🎯 Key Takeaways for Your Retirement Plan:</p>
            <div className="space-y-2 text-sm">
              <div className="flex gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <p><strong>Good returns late = Success:</strong> Building your nest egg during the final years before retirement is ideal</p>
              </div>
              <div className="flex gap-2">
                <span className="text-red-600 font-bold">✗</span>
                <p><strong>Bad returns late = Danger:</strong> Market crashes near retirement can permanently damage your plan</p>
              </div>
              <div className="flex gap-2">
                <span className="text-blue-600 font-bold">→</span>
                <p><strong>De-risk before retirement:</strong> Shifting to lower-risk investments 5-10 years before retirement protects against this risk</p>
              </div>
              <div className="flex gap-2">
                <span className="text-purple-600 font-bold">+</span>
                <p><strong>Build flexibility:</strong> The ability to delay retirement by 1-2 years during a bear market provides a crucial safety margin</p>
              </div>
              <div className="flex gap-2">
                <span className="text-orange-600 font-bold">!</span>
                <p><strong>Math is unforgiving:</strong> A 30% market loss requires a 43% gain to recover - nearly impossible when withdrawing money</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
