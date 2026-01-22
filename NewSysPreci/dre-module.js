// ==================== MÓDULO PRECIFICAÇÃO E DRE ====================

// Configurações padrão do DRE
const DEFAULT_DRE_CONFIG = {
    productId: null,
    markup: 100, // Percentual de acréscimo sobre o custo
    quantity: 100,
    taxSales: 8.5,
    cancellations: 2,
    returns: 1,
    platformFee: 12,
    rentUtilities: 3000,
    salaries: 5000,
    marketing: 500,
    otherExpenses: 500,
    financialExpenses: 200,
    irpj: 15,
    csll: 9
};

// Estado atual da simulação
let dreState = {
    config: { ...DEFAULT_DRE_CONFIG },
    lastCalculation: null,
    simulationHistory: [],
    validationErrors: []
};

// Inicializa o módulo DRE
function initializeDREModule() {
    try {
        // Popula select de produtos
        const productSelect = document.getElementById('dreProductSelect');
        if (!productSelect) {
            console.warn('Elemento dreProductSelect não encontrado');
            return;
        }

        productSelect.innerHTML = '<option value="">Selecione uma pizza...</option>';
        
        if (!Array.isArray(pizzas)) {
            throw new Error('Array de pizzas não está disponível');
        }
        
        pizzas.forEach(pizza => {
            if (pizza && pizza.id && pizza.name && typeof pizza.totalCost === 'number') {
                productSelect.innerHTML += `
                    <option value="${pizza.id}">
                        ${pizza.name} - CMV: R$ ${pizza.totalCost.toFixed(2)}
                    </option>
                `;
            }
        });

        // Restaura seleção anterior do localStorage
        loadDREConfigFromStorage();
        
        // Atualiza simulação inicial
        updateDRESimulation();
        
        console.log('Módulo DRE inicializado com sucesso');
    } catch (error) {
        console.error('Erro ao inicializar módulo DRE:', error);
        showAlert('Erro ao inicializar módulo de precificação', 'error');
    }
}

// Carrega configuração do localStorage
function loadDREConfigFromStorage() {
    try {
        const savedConfig = localStorage.getItem('dreConfig');
        if (savedConfig) {
            const parsedConfig = JSON.parse(savedConfig);
            dreState.config = { ...DEFAULT_DRE_CONFIG, ...parsedConfig };
            
            // Aplica valores nos inputs
            Object.keys(dreState.config).forEach(key => {
                const input = document.getElementById(`dre${key.charAt(0).toUpperCase() + key.slice(1)}`);
                if (input) {
                    input.value = dreState.config[key];
                }
            });
            
            console.log('Configuração DRE carregada do localStorage');
        }
    } catch (error) {
        console.warn('Não foi possível carregar configuração DRE:', error);
    }
}

// Salva configuração no localStorage
function saveDREConfigToStorage() {
    try {
        localStorage.setItem('dreConfig', JSON.stringify(dreState.config));
        console.log('Configuração DRE salva no localStorage');
    } catch (error) {
        console.warn('Não foi possível salvar configuração DRE:', error);
    }
}

// Valida inputs do DRE
function validateDREInputs(params = {}) {
    const errors = [];
    
    // Validações específicas
    if (params.quantity <= 0) {
        errors.push('Quantidade deve ser maior que zero');
    }
    
    if (params.markup < 0) {
        errors.push('Markup não pode ser negativo');
    }
    
    if (params.taxSales < 0 || params.taxSales > 100) {
        errors.push('Impostos sobre vendas deve estar entre 0% e 100%');
    }
    
    // Valida todos os percentuais
    const percentFields = ['cancellations', 'returns', 'platformFee', 'irpj', 'csll'];
    percentFields.forEach(field => {
        const value = params[field];
        if (value < 0 || value > 100) {
            errors.push(`${field} deve estar entre 0% e 100%`);
        }
    });
    
    // Valida valores monetários
    const monetaryFields = ['rentUtilities', 'salaries', 'marketing', 'otherExpenses', 'financialExpenses'];
    monetaryFields.forEach(field => {
        const value = params[field];
        if (value < 0) {
            errors.push(`${field} não pode ser negativo`);
        }
        if (value > 10000000) {
            errors.push(`${field} é muito alto`);
        }
    });
    
    dreState.validationErrors = errors;
    return errors.length === 0;
}

// Aplica regime tributário predefinido
function applyTaxRegime() {
    try {
        const regimeSelect = document.getElementById('dreTaxRegime');
        if (!regimeSelect) return;

        const regime = regimeSelect.value;
        let taxConfig;

        switch(regime) {
            case 'simples':
                taxConfig = { taxSales: 6, irpj: 0, csll: 0 };
                break;
            case 'presumido':
                taxConfig = { taxSales: 11.33, irpj: 15, csll: 9 };
                break;
            case 'real':
                taxConfig = { taxSales: 9.25, irpj: 25, csll: 9 };
                break;
            case 'custom':
            default:
                return; // Mantém valores atuais
        }

        // Aplica valores
        Object.keys(taxConfig).forEach(key => {
            const inputId = `dre${key.charAt(0).toUpperCase() + key.slice(1)}`;
            const input = document.getElementById(inputId);
            if (input) {
                input.value = taxConfig[key];
            }
        });

        updateDRESimulation();
        showAlert(`Regime ${regime} aplicado com sucesso`, 'success');
    } catch (error) {
        console.error('Erro ao aplicar regime tributário:', error);
        showAlert('Erro ao aplicar regime tributário', 'error');
    }
}

// Carrega custos operacionais do sistema para o DRE
function loadOperationalCostsToDRE() {
    try {
        if (!operationalCosts) {
            showAlert('Custos operacionais não disponíveis', 'warning');
            return;
        }

        // Calcula aluguel e utilidades
        const rentUtilities = (operationalCosts.rent || 0) +
                            (operationalCosts.electricity || 0) +
                            (operationalCosts.water || 0) +
                            (operationalCosts.gas || 0) +
                            (operationalCosts.internet || 0);

        // Aplica nos campos
        const mappings = {
            rentUtilities: rentUtilities,
            salaries: operationalCosts.salaries || 0,
            marketing: operationalCosts.marketing || 0,
            otherExpenses: (operationalCosts.cleaning || 0) +
                          (operationalCosts.bankFees || 0) +
                          (operationalCosts.others || 0)
        };

        Object.keys(mappings).forEach(key => {
            const inputId = `dre${key.charAt(0).toUpperCase() + key.slice(1)}`;
            const input = document.getElementById(inputId);
            if (input) {
                input.value = mappings[key];
            }
        });

        updateDRESimulation();
        showAlert('Custos operacionais carregados com sucesso', 'success');
    } catch (error) {
        console.error('Erro ao carregar custos operacionais:', error);
        showAlert('Erro ao carregar custos operacionais', 'error');
    }
}

// Obtém parâmetros dos inputs
function getDREParameters() {
    try {
        const params = {};
        
        // Função auxiliar para obter valor do input
        const getValue = (id, isFloat = false, defaultValue = 0) => {
            const element = document.getElementById(id);
            if (!element) return defaultValue;
            
            const value = element.value.trim();
            if (value === '') return defaultValue;
            
            return isFloat ? parseFloat(value) : parseInt(value, 10);
        };

        params.productId = getValue('dreProductSelect', false, null);
        params.markup = getValue('dreMarkup', true, DEFAULT_DRE_CONFIG.markup);
        params.quantity = getValue('dreQuantity', false, DEFAULT_DRE_CONFIG.quantity);
        params.taxSales = getValue('dreTaxSales', true, DEFAULT_DRE_CONFIG.taxSales);
        params.cancellations = getValue('dreCancellations', true, DEFAULT_DRE_CONFIG.cancellations);
        params.returns = getValue('dreReturns', true, DEFAULT_DRE_CONFIG.returns);
        params.platformFee = getValue('drePlatformFee', true, DEFAULT_DRE_CONFIG.platformFee);
        params.rentUtilities = getValue('dreRentUtilities', true, DEFAULT_DRE_CONFIG.rentUtilities);
        params.salaries = getValue('dreSalaries', true, DEFAULT_DRE_CONFIG.salaries);
        params.marketing = getValue('dreMarketing', true, DEFAULT_DRE_CONFIG.marketing);
        params.otherExpenses = getValue('dreOtherExpenses', true, DEFAULT_DRE_CONFIG.otherExpenses);
        params.financialExpenses = getValue('dreFinancialExpenses', true, DEFAULT_DRE_CONFIG.financialExpenses);
        params.irpj = getValue('dreIRPJ', true, DEFAULT_DRE_CONFIG.irpj);
        params.csll = getValue('dreCSLL', true, DEFAULT_DRE_CONFIG.csll);

        // Valida os parâmetros
        if (!validateDREInputs(params)) {
            throw new Error(`Erros de validação: ${dreState.validationErrors.join(', ')}`);
        }

        // Atualiza configuração atual
        dreState.config = { ...params };
        saveDREConfigToStorage();

        return params;
    } catch (error) {
        console.error('Erro ao obter parâmetros DRE:', error);
        throw error;
    }
}

// Função principal de cálculo do DRE (otimizada)
function calculateDRE(params = null) {
    try {
        // Obtém parâmetros (do input ou passados)
        const calculationParams = params || getDREParameters();
        
        // Valida produto
        const productId = calculationParams.productId;
        if (!productId) {
            throw new Error('Selecione um produto para calcular o DRE');
        }

        const product = pizzas.find(p => p.id === productId);
        if (!product) {
            throw new Error('Produto não encontrado');
        }

        const cmv = product.totalCost || 0;

        // 1. PRECIFICAÇÃO (Corrigido)
        // Markup = percentual de acréscimo sobre o custo
        // Exemplo: markup=100% → preço = custo + (custo × 100%) = custo × 2
        const markupMultiplier = 1 + (calculationParams.markup / 100);
        const salePrice = cmv * markupMultiplier;

        // 2. RECEITA
        const grossRevenue = salePrice * calculationParams.quantity;
        
        // Cálculos de deduções (evita repetição)
        const deductionRates = {
            taxSales: calculationParams.taxSales / 100,
            cancellations: calculationParams.cancellations / 100,
            returns: calculationParams.returns / 100,
            platformFee: calculationParams.platformFee / 100
        };

        const taxSalesValue = grossRevenue * deductionRates.taxSales;
        const cancellationsValue = grossRevenue * deductionRates.cancellations;
        const returnsValue = grossRevenue * deductionRates.returns;
        const platformFeeValue = grossRevenue * deductionRates.platformFee;
        const totalDeductions = taxSalesValue + cancellationsValue + returnsValue + platformFeeValue;
        const netRevenue = Math.max(0, grossRevenue - totalDeductions);

        // 3. CUSTOS E DESPESAS
        const totalCMV = cmv * calculationParams.quantity;
        const grossProfit = netRevenue - totalCMV;

        const totalOperationalExpenses = calculationParams.rentUtilities +
                                       calculationParams.salaries +
                                       calculationParams.marketing +
                                       calculationParams.otherExpenses;

        const operationalResult = grossProfit - totalOperationalExpenses;
        const profitBeforeTax = operationalResult - calculationParams.financialExpenses;

        // Impostos sobre o lucro (apenas se houver lucro)
        const hasProfit = profitBeforeTax > 0;
        const irpjValue = hasProfit ? profitBeforeTax * (calculationParams.irpj / 100) : 0;
        const csllValue = hasProfit ? profitBeforeTax * (calculationParams.csll / 100) : 0;
        const totalIncomeTax = irpjValue + csllValue;
        const netProfit = profitBeforeTax - totalIncomeTax;

        // 4. INDICADORES (com proteção contra divisão por zero)
        const safeDivide = (numerator, denominator) => 
            denominator !== 0 ? (numerator / denominator) * 100 : 0;

        const netMargin = safeDivide(netProfit, netRevenue);
        const grossMargin = safeDivide(grossProfit, netRevenue);
        const operationalMargin = safeDivide(operationalResult, netRevenue);

        // 5. PONTO DE EQUILÍBRIO
        const variableCostsPerUnit = cmv + (salePrice * (calculationParams.taxSales + 
            calculationParams.cancellations + calculationParams.returns + 
            calculationParams.platformFee) / 100);
        
        const contributionMarginPerUnit = salePrice - variableCostsPerUnit;
        const fixedCosts = totalOperationalExpenses + calculationParams.financialExpenses;
        
        const breakeven = contributionMarginPerUnit > 0 ? 
            Math.ceil(Math.max(0, fixedCosts) / contributionMarginPerUnit) : 0;

        // 6. Percentuais sobre Receita Bruta (cálculo otimizado)
        const percentages = {};
        const percentageBase = grossRevenue || 1; // Evita divisão por zero
        
        const percentageItems = [
            { key: 'taxSales', value: taxSalesValue },
            { key: 'cancellations', value: cancellationsValue },
            { key: 'returns', value: returnsValue },
            { key: 'platformFee', value: platformFeeValue },
            { key: 'netRevenue', value: netRevenue },
            { key: 'totalCMV', value: totalCMV },
            { key: 'grossProfit', value: grossProfit },
            { key: 'operationalExpenses', value: totalOperationalExpenses },
            { key: 'operationalResult', value: operationalResult },
            { key: 'financialExpenses', value: calculationParams.financialExpenses },
            { key: 'profitBeforeTax', value: profitBeforeTax },
            { key: 'incomeTax', value: totalIncomeTax },
            { key: 'netProfit', value: netProfit }
        ];

        percentageItems.forEach(item => {
            percentages[item.key] = (item.value / percentageBase) * 100;
        });

        // 7. Prepara resultado
        const result = {
            // Inputs
            cmv,
            salePrice,
            markupMultiplier,
            quantity: calculationParams.quantity,

            // Receita
            grossRevenue,
            taxSalesValue,
            cancellationsValue,
            returnsValue,
            platformFeeValue,
            totalDeductions,
            netRevenue,

            // Custos e Despesas
            totalCMV,
            grossProfit,
            rentUtilities: calculationParams.rentUtilities,
            salaries: calculationParams.salaries,
            marketing: calculationParams.marketing,
            otherExpenses: calculationParams.otherExpenses,
            totalOperationalExpenses,
            operationalResult,
            financialExpenses: calculationParams.financialExpenses,
            profitBeforeTax,
            irpjValue,
            csllValue,
            totalIncomeTax,
            netProfit,

            // Margens
            netMargin,
            grossMargin,
            operationalMargin,
            breakeven,

            // Percentuais
            percentages,

            // Metadados
            productName: product.name,
            calculationTimestamp: new Date().toISOString()
        };

        // Salva no histórico
        saveToSimulationHistory(result);

        // Atualiza estado
        dreState.lastCalculation = result;

        return result;
    } catch (error) {
        console.error('Erro no cálculo DRE:', error);
        showAlert(`Erro no cálculo: ${error.message}`, 'error');
        
        // Retorna estrutura vazia em caso de erro
        return createEmptyDREResult();
    }
}

// Cria resultado DRE vazio para tratamento de erros
function createEmptyDREResult() {
    const emptyValue = {
        cmv: 0,
        salePrice: 0,
        markupMultiplier: 0,
        quantity: 0,
        grossRevenue: 0,
        taxSalesValue: 0,
        cancellationsValue: 0,
        returnsValue: 0,
        platformFeeValue: 0,
        totalDeductions: 0,
        netRevenue: 0,
        totalCMV: 0,
        grossProfit: 0,
        rentUtilities: 0,
        salaries: 0,
        marketing: 0,
        otherExpenses: 0,
        totalOperationalExpenses: 0,
        operationalResult: 0,
        financialExpenses: 0,
        profitBeforeTax: 0,
        irpjValue: 0,
        csllValue: 0,
        totalIncomeTax: 0,
        netProfit: 0,
        netMargin: 0,
        grossMargin: 0,
        operationalMargin: 0,
        breakeven: 0,
        percentages: {
            taxSales: 0,
            cancellations: 0,
            returns: 0,
            platformFee: 0,
            netRevenue: 0,
            totalCMV: 0,
            grossProfit: 0,
            operationalExpenses: 0,
            operationalResult: 0,
            financialExpenses: 0,
            profitBeforeTax: 0,
            incomeTax: 0,
            netProfit: 0
        },
        productName: 'Nenhum',
        calculationTimestamp: new Date().toISOString()
    };
    
    return emptyValue;
}

// Salva simulação no histórico
function saveToSimulationHistory(dreResult) {
    try {
        dreState.simulationHistory.push({
            ...dreResult,
            savedAt: new Date().toISOString(),
            config: { ...dreState.config }
        });

        // Mantém apenas as últimas 20 simulações
        if (dreState.simulationHistory.length > 20) {
            dreState.simulationHistory = dreState.simulationHistory.slice(-20);
        }
    } catch (error) {
        console.warn('Erro ao salvar no histórico:', error);
    }
}

// Atualiza toda a simulação DRE
function updateDRESimulation() {
    try {
        const dre = calculateDRE();
        
        if (!dre) {
            throw new Error('Falha ao calcular DRE');
        }

        // Atualiza displays de Precificação
        updatePricingDisplays(dre);
        
        // Atualiza tabela DRE
        renderDRETable(dre);
        
        // Atualiza indicadores
        updatePerformanceIndicators(dre);
        
        // Atualiza análise de sensibilidade (otimizada)
        updateSensitivityAnalysisOptimized(dre);
        
        // Atualiza gráfico de composição
        renderPriceCompositionChart(dre);
        
        console.log('Simulação DRE atualizada com sucesso');
    } catch (error) {
        console.error('Erro ao atualizar simulação DRE:', error);
        showAlert('Erro ao atualizar simulação. Verifique os dados.', 'error');
    }
}

// Atualiza displays de precificação
function updatePricingDisplays(dre) {
    const displays = [
        { id: 'dreCMVDisplay', value: dre.cmv, prefix: 'R$ ' },
        { id: 'dreMarkupDisplay', value: dre.markupMultiplier, suffix: 'x', decimals: 2 },
        { id: 'dreSalePriceDisplay', value: dre.salePrice, prefix: 'R$ ' },
        { id: 'dreGrossProfitUnit', value: dre.salePrice - dre.cmv, prefix: 'R$ ' }
    ];
    
    displays.forEach(display => {
        const element = document.getElementById(display.id);
        if (element) {
            let formattedValue = display.value.toFixed(display.decimals || 2);
            element.textContent = `${display.prefix || ''}${formattedValue}${display.suffix || ''}`;
        }
    });
}

// Renderiza a tabela DRE
function renderDRETable(dre) {
    const tbody = document.getElementById('dreTableBody');
    if (!tbody) return;

    // Funções auxiliares de formatação
    const formatCurrency = (value) => 
        `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    
    const formatPercent = (value) => `${Math.abs(value).toFixed(2)}%`;
    
    const getImpactBar = (percent, isPositive) => {
        const width = Math.min(Math.abs(percent), 100);
        const color = isPositive ? 'bg-green-500' : 'bg-red-500';
        return `
            <div class="w-24 bg-gray-200 rounded-full h-3 mx-auto">
                <div class="${color} h-3 rounded-full" style="width: ${width}%"></div>
            </div>
        `;
    };

    // Template da tabela
    tbody.innerHTML = `
        <!-- Receita Bruta -->
        <tr class="bg-blue-50 font-semibold border-b border-blue-200">
            <td class="py-3 px-4 text-left text-blue-800">📈 RECEITA BRUTA</td>
            <td class="py-3 px-4 text-right text-blue-800">${formatCurrency(dre.grossRevenue)}</td>
            <td class="py-3 px-4 text-right text-blue-800">100,00%</td>
            <td class="py-3 px-4 text-center">${getImpactBar(100, true)}</td>
        </tr>

        <!-- Deduções da Receita -->
        ${renderDeductionRow('Impostos sobre Venda', dre.taxSalesValue, dre.percentages.taxSales)}
        ${renderDeductionRow('Cancelamentos', dre.cancellationsValue, dre.percentages.cancellations)}
        ${renderDeductionRow('Devoluções', dre.returnsValue, dre.percentages.returns)}
        ${renderDeductionRow('Taxas de Plataforma', dre.platformFeeValue, dre.percentages.platformFee, true)}

        <!-- Receita Líquida -->
        <tr class="bg-green-50 font-semibold border-b border-green-200">
            <td class="py-3 px-4 text-left text-green-800">💵 RECEITA LÍQUIDA</td>
            <td class="py-3 px-4 text-right text-green-800">${formatCurrency(dre.netRevenue)}</td>
            <td class="py-3 px-4 text-right text-green-800">${formatPercent(dre.percentages.netRevenue)}</td>
            <td class="py-3 px-4 text-center">${getImpactBar(dre.percentages.netRevenue, dre.netRevenue >= 0)}</td>
        </tr>

        <!-- CMV -->
        <tr class="border-b border-gray-200 hover:bg-gray-50">
            <td class="py-2 px-4 text-left pl-8 text-gray-600">(-) CMV (Custo da Mercadoria Vendida)</td>
            <td class="py-2 px-4 text-right text-red-600">(${formatCurrency(dre.totalCMV)})</td>
            <td class="py-2 px-4 text-right text-red-600">${formatPercent(dre.percentages.totalCMV)}</td>
            <td class="py-3 px-4 text-center">${getImpactBar(dre.percentages.totalCMV, false)}</td>
        </tr>

        <!-- Lucro Bruto -->
        <tr class="bg-purple-50 font-semibold border-b border-purple-200">
            <td class="py-3 px-4 text-left text-purple-800">📊 LUCRO BRUTO</td>
            <td class="py-3 px-4 text-right ${dre.grossProfit >= 0 ? 'text-purple-800' : 'text-red-600'}">
                ${dre.grossProfit >= 0 ? formatCurrency(dre.grossProfit) : `(${formatCurrency(-dre.grossProfit)})`}
            </td>
            <td class="py-3 px-4 text-right ${dre.grossProfit >= 0 ? 'text-purple-800' : 'text-red-600'}">
                ${formatPercent(dre.percentages.grossProfit)}
            </td>
            <td class="py-3 px-4 text-center">${getImpactBar(dre.percentages.grossProfit, dre.grossProfit >= 0)}</td>
        </tr>

        <!-- Despesas Operacionais -->
        ${renderExpenseRow('Aluguel e Contas', dre.rentUtilities, dre.grossRevenue)}
        ${renderExpenseRow('Salários e Encargos', dre.salaries, dre.grossRevenue)}
        ${renderExpenseRow('Marketing', dre.marketing, dre.grossRevenue)}
        ${renderExpenseRow('Outras Despesas', dre.otherExpenses, dre.grossRevenue, true)}

        <!-- Resultado Operacional -->
        <tr class="bg-orange-50 font-semibold border-b border-orange-200">
            <td class="py-3 px-4 text-left text-orange-800">⚡ RESULTADO OPERACIONAL (EBITDA)</td>
            <td class="py-3 px-4 text-right ${dre.operationalResult >= 0 ? 'text-orange-800' : 'text-red-600'}">
                ${dre.operationalResult >= 0 ? formatCurrency(dre.operationalResult) : `(${formatCurrency(-dre.operationalResult)})`}
            </td>
            <td class="py-3 px-4 text-right text-orange-800">${formatPercent(dre.percentages.operationalResult)}</td>
            <td class="py-3 px-4 text-center">${getImpactBar(Math.abs(dre.percentages.operationalResult), dre.operationalResult >= 0)}</td>
        </tr>

        <!-- Despesas Financeiras -->
        <tr class="border-b border-gray-200 hover:bg-gray-50">
            <td class="py-2 px-4 text-left pl-8 text-gray-600">(-) Despesas Financeiras</td>
            <td class="py-2 px-4 text-right text-red-600">(${formatCurrency(dre.financialExpenses)})</td>
            <td class="py-2 px-4 text-right text-red-600">${formatPercent(dre.percentages.financialExpenses)}</td>
            <td class="py-3 px-4 text-center">${getImpactBar(dre.percentages.financialExpenses, false)}</td>
        </tr>

        <!-- Lucro Antes dos Impostos -->
        <tr class="bg-yellow-50 font-semibold border-b border-yellow-200">
            <td class="py-3 px-4 text-left text-yellow-800">📋 LUCRO ANTES DOS IMPOSTOS</td>
            <td class="py-3 px-4 text-right ${dre.profitBeforeTax >= 0 ? 'text-yellow-800' : 'text-red-600'}">
                ${dre.profitBeforeTax >= 0 ? formatCurrency(dre.profitBeforeTax) : `(${formatCurrency(-dre.profitBeforeTax)})`}
            </td>
            <td class="py-3 px-4 text-right text-yellow-800">${formatPercent(dre.percentages.profitBeforeTax)}</td>
            <td class="py-3 px-4 text-center">${getImpactBar(Math.abs(dre.percentages.profitBeforeTax), dre.profitBeforeTax >= 0)}</td>
        </tr>

        <!-- Impostos sobre Lucro -->
        <tr class="border-b border-gray-100 hover:bg-gray-50">
            <td class="py-2 px-4 text-left pl-8 text-gray-600">(-) IRPJ</td>
            <td class="py-2 px-4 text-right text-red-600">(${formatCurrency(dre.irpjValue)})</td>
            <td class="py-2 px-4 text-right text-red-600">${formatPercent(dre.irpjValue / (dre.grossRevenue || 1) * 100)}</td>
            <td class="py-2 px-4 text-center">${getImpactBar(dre.irpjValue / (dre.grossRevenue || 1) * 100, false)}</td>
        </tr>
        <tr class="border-b border-gray-200 hover:bg-gray-50">
            <td class="py-2 px-4 text-left pl-8 text-gray-600">(-) CSLL</td>
            <td class="py-2 px-4 text-right text-red-600">(${formatCurrency(dre.csllValue)})</td>
            <td class="py-2 px-4 text-right text-red-600">${formatPercent(dre.csllValue / (dre.grossRevenue || 1) * 100)}</td>
            <td class="py-2 px-4 text-center">${getImpactBar(dre.csllValue / (dre.grossRevenue || 1) * 100, false)}</td>
        </tr>

        <!-- Lucro Líquido -->
        <tr class="bg-gradient-to-r from-green-100 to-emerald-100 font-bold border-t-2 border-green-400">
            <td class="py-4 px-4 text-left text-green-900 text-lg">💰 LUCRO LÍQUIDO</td>
            <td class="py-4 px-4 text-right text-lg ${dre.netProfit >= 0 ? 'text-green-900' : 'text-red-600'}">
                ${dre.netProfit >= 0 ? formatCurrency(dre.netProfit) : `(${formatCurrency(-dre.netProfit)})`}
            </td>
            <td class="py-4 px-4 text-right text-green-900 text-lg">${formatPercent(dre.percentages.netProfit)}</td>
            <td class="py-4 px-4 text-center">${getImpactBar(Math.abs(dre.percentages.netProfit), dre.netProfit >= 0)}</td>
        </tr>
    `;
}

// Renderiza linha de dedução (reutilizável)
function renderDeductionRow(label, value, percentage, isLast = false) {
    const borderClass = isLast ? 'border-b border-gray-200' : 'border-b border-gray-100';
    return `
        <tr class="${borderClass} hover:bg-gray-50">
            <td class="py-2 px-4 text-left pl-8 text-gray-600">(-) ${label}</td>
            <td class="py-2 px-4 text-right text-red-600">(${formatCurrency(value)})</td>
            <td class="py-2 px-4 text-right text-red-600">${percentage.toFixed(2)}%</td>
            <td class="py-2 px-4 text-center">${getImpactBar(percentage, false)}</td>
        </tr>
    `;
}

// Renderiza linha de despesa (reutilizável)
function renderExpenseRow(label, value, grossRevenue, isLast = false) {
    const borderClass = isLast ? 'border-b border-gray-200' : 'border-b border-gray-100';
    const percentage = grossRevenue > 0 ? (value / grossRevenue * 100) : 0;
    
    return `
        <tr class="${borderClass} hover:bg-gray-50">
            <td class="py-2 px-4 text-left pl-8 text-gray-600">(-) ${label}</td>
            <td class="py-2 px-4 text-right text-red-600">(${formatCurrency(value)})</td>
            <td class="py-2 px-4 text-right text-red-600">${percentage.toFixed(2)}%</td>
            <td class="py-2 px-4 text-center">${getImpactBar(percentage, false)}</td>
        </tr>
    `;
}

// Funções de formatação auxiliares (necessárias para as funções acima)
function formatCurrency(value) {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getImpactBar(percent, isPositive) {
    const width = Math.min(Math.abs(percent), 100);
    const color = isPositive ? 'bg-green-500' : 'bg-red-500';
    return `
        <div class="w-24 bg-gray-200 rounded-full h-3 mx-auto">
            <div class="${color} h-3 rounded-full" style="width: ${width}%"></div>
        </div>
    `;
}

// Atualiza indicadores de performance
function updatePerformanceIndicators(dre) {
    try {
        // Margem Líquida
        const netMarginEl = document.getElementById('dreNetMargin');
        const marginIcon = document.getElementById('dreMarginIcon');
        
        if (netMarginEl) {
            netMarginEl.textContent = `${dre.netMargin.toFixed(1)}%`;
            
            // Atualiza cor e ícone baseado na margem
            if (dre.netMargin >= 15) {
                netMarginEl.className = 'text-3xl font-bold text-green-600';
                if (marginIcon) {
                    marginIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>';
                    marginIcon.className = 'w-12 h-12 text-green-500';
                }
            } else if (dre.netMargin >= 5) {
                netMarginEl.className = 'text-3xl font-bold text-yellow-600';
                if (marginIcon) {
                    marginIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>';
                    marginIcon.className = 'w-12 h-12 text-yellow-500';
                }
            } else {
                netMarginEl.className = 'text-3xl font-bold text-red-600';
                if (marginIcon) {
                    marginIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>';
                    marginIcon.className = 'w-12 h-12 text-red-500';
                }
            }
        }

        // Outros indicadores
        updateIndicator('dreGrossMargin', `${dre.grossMargin.toFixed(1)}%`);
        updateIndicator('dreOperationalMargin', `${dre.operationalMargin.toFixed(1)}%`);
        updateIndicator('dreBreakeven', `${dre.breakeven.toLocaleString('pt-BR')} un.`);
        
    } catch (error) {
        console.error('Erro ao atualizar indicadores:', error);
    }
}

// Atualiza um indicador específico
function updateIndicator(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}

// Análise de sensibilidade otimizada
function updateSensitivityAnalysisOptimized(baseDRE) {
    try {
        if (!baseDRE) return;

        const scenarios = [
            {
                id: 'dreSensMarkup',
                label: 'Aumentar Markup 10%',
                calculate: () => {
                    const currentMarkup = parseFloat(document.getElementById('dreMarkup')?.value) || 100;
                    return calculateDRE({ markup: currentMarkup * 1.1 });
                }
            },
            {
                id: 'dreSensQuantity',
                label: 'Aumentar Quantidade 20%',
                calculate: () => {
                    const currentQty = parseInt(document.getElementById('dreQuantity')?.value) || 100;
                    return calculateDRE({ quantity: Math.ceil(currentQty * 1.2) });
                }
            },
            {
                id: 'dreSensCMV',
                label: 'Reduzir CMV 10%',
                calculate: () => {
                    const productId = parseInt(document.getElementById('dreProductSelect')?.value);
                    const product = pizzas.find(p => p.id === productId);
                    if (!product) return null;
                    
                    const reducedCMV = product.totalCost * 0.9;
                    const modifiedProduct = { ...product, totalCost: reducedCMV };
                    
                    // Cria array temporário sem modificar o original
                    const tempPizzas = pizzas.map(p => 
                        p.id === productId ? modifiedProduct : p
                    );
                    
                    // Cálculo com array temporário
                    const originalPizzas = pizzas;
                    try {
                        // Temporariamente substitui o array global
                        window.tempPizzasForCalculation = tempPizzas;
                        const originalCalculate = window.calculateDRE;
                        
                        // Função temporária que usa o array modificado
                        window.calculateDRE = function(params) {
                            const originalParams = params || getDREParameters();
                            const tempProduct = tempPizzas.find(p => p.id === originalParams.productId);
                            if (!tempProduct) return createEmptyDREResult();
                            
                            const tempParams = { ...originalParams };
                            return calculateDRECore(tempParams, tempPizzas);
                        };
                        
                        const scenario = window.calculateDRE();
                        return scenario;
                    } finally {
                        // Restaura estado original
                        window.calculateDRE = originalCalculate;
                        delete window.tempPizzasForCalculation;
                    }
                }
            },
            {
                id: 'dreSensExpenses',
                label: 'Reduzir Despesas 15%',
                calculate: () => {
                    const rentUtilities = parseFloat(document.getElementById('dreRentUtilities')?.value) || 3000;
                    const salaries = parseFloat(document.getElementById('dreSalaries')?.value) || 5000;
                    const marketing = parseFloat(document.getElementById('dreMarketing')?.value) || 500;
                    const otherExpenses = parseFloat(document.getElementById('dreOtherExpenses')?.value) || 500;
                    
                    return calculateDRE({
                        rentUtilities: rentUtilities * 0.85,
                        salaries: salaries * 0.85,
                        marketing: marketing * 0.85,
                        otherExpenses: otherExpenses * 0.85
                    });
                }
            }
        ];

        // Processa cada cenário
        scenarios.forEach(scenario => {
            try {
                const element = document.getElementById(scenario.id);
                if (!element) return;

                const scenarioResult = scenario.calculate();
                if (!scenarioResult) {
                    element.textContent = 'Não disponível';
                    element.className = 'text-lg font-bold text-gray-500';
                    return;
                }

                const diff = scenarioResult.netProfit - baseDRE.netProfit;
                const isPositive = diff >= 0;
                const sign = isPositive ? '+' : '';
                
                element.textContent = `${sign}R$ ${Math.abs(diff).toFixed(2)} no lucro`;
                element.className = `text-lg font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`;
            } catch (error) {
                console.warn(`Erro no cenário ${scenario.label}:`, error);
                const element = document.getElementById(scenario.id);
                if (element) {
                    element.textContent = 'Erro no cálculo';
                    element.className = 'text-lg font-bold text-gray-500';
                }
            }
        });
    } catch (error) {
        console.error('Erro na análise de sensibilidade:', error);
    }
}

// Função core de cálculo DRE (separada para reutilização)
function calculateDRECore(params, pizzaArray = pizzas) {
    // Implementação similar à calculateDRE mas recebe array como parâmetro
    try {
        const product = pizzaArray.find(p => p.id === params.productId);
        if (!product) return createEmptyDREResult();

        const cmv = product.totalCost || 0;
        const markupMultiplier = 1 + (params.markup / 100);
        const salePrice = cmv * markupMultiplier;
        const grossRevenue = salePrice * params.quantity;
        
        // Cálculos similares à função principal...
        const taxSalesValue = grossRevenue * (params.taxSales / 100);
        const cancellationsValue = grossRevenue * (params.cancellations / 100);
        const returnsValue = grossRevenue * (params.returns / 100);
        const platformFeeValue = grossRevenue * (params.platformFee / 100);
        const totalDeductions = taxSalesValue + cancellationsValue + returnsValue + platformFeeValue;
        const netRevenue = Math.max(0, grossRevenue - totalDeductions);
        const totalCMV = cmv * params.quantity;
        const grossProfit = netRevenue - totalCMV;
        const totalOperationalExpenses = params.rentUtilities + params.salaries + params.marketing + params.otherExpenses;
        const operationalResult = grossProfit - totalOperationalExpenses;
        const profitBeforeTax = operationalResult - params.financialExpenses;
        const irpjValue = profitBeforeTax > 0 ? profitBeforeTax * (params.irpj / 100) : 0;
        const csllValue = profitBeforeTax > 0 ? profitBeforeTax * (params.csll / 100) : 0;
        const totalIncomeTax = irpjValue + csllValue;
        const netProfit = profitBeforeTax - totalIncomeTax;

        return {
            cmv, salePrice, markupMultiplier, quantity: params.quantity,
            grossRevenue, taxSalesValue, cancellationsValue, returnsValue,
            platformFeeValue, totalDeductions, netRevenue, totalCMV,
            grossProfit, rentUtilities: params.rentUtilities,
            salaries: params.salaries, marketing: params.marketing,
            otherExpenses: params.otherExpenses, totalOperationalExpenses,
            operationalResult, financialExpenses: params.financialExpenses,
            profitBeforeTax, irpjValue, csllValue, totalIncomeTax,
            netProfit, netMargin: 0, grossMargin: 0, operationalMargin: 0,
            breakeven: 0, percentages: {}, productName: product.name
        };
    } catch (error) {
        console.error('Erro no calculateDRECore:', error);
        return createEmptyDREResult();
    }
}

// Renderiza composição do preço com gráfico
function renderPriceCompositionChart(dre) {
    try {
        const container = document.getElementById('drePriceComposition');
        const chartContainer = document.getElementById('dreWaterfallChart');
        
        if (!container || !chartContainer) return;

        const items = [
            { 
                label: 'CMV', 
                value: dre.totalCMV, 
                color: 'bg-red-500', 
                percent: dre.percentages.totalCMV 
            },
            { 
                label: 'Impostos', 
                value: dre.taxSalesValue, 
                color: 'bg-orange-500', 
                percent: dre.percentages.taxSales 
            },
            { 
                label: 'Plataforma', 
                value: dre.platformFeeValue, 
                color: 'bg-yellow-500', 
                percent: dre.percentages.platformFee 
            },
            { 
                label: 'Desp. Operacionais', 
                value: dre.totalOperationalExpenses, 
                color: 'bg-blue-500', 
                percent: dre.percentages.operationalExpenses 
            },
            { 
                label: 'Desp. Financeiras', 
                value: dre.financialExpenses, 
                color: 'bg-purple-500', 
                percent: dre.percentages.financialExpenses 
            },
            { 
                label: 'IR + CSLL', 
                value: dre.totalIncomeTax, 
                color: 'bg-pink-500', 
                percent: dre.percentages.incomeTax 
            },
            { 
                label: 'Lucro Líquido', 
                value: dre.netProfit, 
                color: dre.netProfit >= 0 ? 'bg-green-500' : 'bg-red-700', 
                percent: Math.abs(dre.percentages.netProfit) 
            }
        ];

        // Renderiza legendas
        container.innerHTML = items.map(item => `
            <div class="flex items-center space-x-2 px-4 py-2 rounded-lg bg-gray-50 border border-gray-200">
                <div class="w-4 h-4 ${item.color} rounded"></div>
                <span class="text-sm font-medium text-gray-700">${item.label}:</span>
                <span class="text-sm text-gray-600">${item.percent.toFixed(1)}%</span>
            </div>
        `).join('');

        // Renderiza gráfico waterfall
        const maxHeight = 200;
        const maxValue = Math.max(dre.grossRevenue, Math.abs(dre.netProfit), 1);
        
        const getHeight = (value) => Math.max((Math.abs(value) / maxValue) * maxHeight, 5);
        const getColor = (value, positiveColor, negativeColor) => 
            value >= 0 ? positiveColor : negativeColor;

        chartContainer.innerHTML = `
            <div class="flex items-end space-x-2 h-64">
                <!-- Receita Bruta -->
                <div class="flex flex-col items-center">
                    <div class="bg-blue-500 rounded-t w-12" style="height: ${maxHeight}px;"></div>
                    <p class="text-xs mt-1 text-center font-medium">Receita<br>Bruta</p>
                </div>
                
                <!-- Deduções -->
                <div class="flex flex-col items-center">
                    <div class="bg-red-400 rounded w-12" style="height: ${getHeight(dre.totalDeductions)}px;"></div>
                    <p class="text-xs mt-1 text-center">Deduções</p>
                </div>
                
                <!-- Receita Líquida -->
                <div class="flex flex-col items-center">
                    <div class="bg-green-400 rounded w-12" style="height: ${getHeight(dre.netRevenue)}px;"></div>
                    <p class="text-xs mt-1 text-center">Receita<br>Líquida</p>
                </div>
                
                <!-- CMV -->
                <div class="flex flex-col items-center">
                    <div class="bg-red-500 rounded w-12" style="height: ${getHeight(dre.totalCMV)}px;"></div>
                    <p class="text-xs mt-1 text-center">CMV</p>
                </div>
                
                <!-- Lucro Bruto -->
                <div class="flex flex-col items-center">
                    <div class="${getColor(dre.grossProfit, 'bg-purple-400', 'bg-red-400')} rounded w-12" 
                         style="height: ${getHeight(dre.grossProfit)}px;"></div>
                    <p class="text-xs mt-1 text-center">Lucro<br>Bruto</p>
                </div>
                
                <!-- Despesas Operacionais -->
                <div class="flex flex-col items-center">
                    <div class="bg-orange-400 rounded w-12" style="height: ${getHeight(dre.totalOperationalExpenses)}px;"></div>
                    <p class="text-xs mt-1 text-center">Desp.<br>Oper.</p>
                </div>
                
                <!-- Lucro Líquido -->
                <div class="flex flex-col items-center">
                    <div class="${dre.netProfit >= 0 ? 'bg-green-600' : 'bg-red-600'} rounded w-12" 
                         style="height: ${getHeight(dre.netProfit)}px;"></div>
                    <p class="text-xs mt-1 text-center font-bold">Lucro<br>Líquido</p>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Erro ao renderizar composição do preço:', error);
    }
}

// Exporta relatório DRE em CSV
function exportDRECSV() {
    try {
        const dre = dreState.lastCalculation;
        if (!dre) {
            showAlert('Execute uma simulação antes de exportar', 'warning');
            return;
        }

        const productName = dre.productName || 'Produto não selecionado';
        const date = new Date().toLocaleDateString('pt-BR');
        const timestamp = new Date().toLocaleTimeString('pt-BR');

        let csv = `RELATÓRIO DE DRE - ${date} ${timestamp}\n`;
        csv += `Produto: ${productName}\n`;
        csv += `Markup: ${document.getElementById('dreMarkup')?.value || 100}%\n`;
        csv += `Quantidade: ${document.getElementById('dreQuantity')?.value || 100} unidades\n`;
        csv += `Receita Bruta: R$ ${dre.grossRevenue.toFixed(2)}\n\n`;

        csv += `Descrição,Valor (R$),% s/ Receita Bruta\n`;
        csv += `RECEITA BRUTA,${dre.grossRevenue.toFixed(2)},100.00%\n`;
        csv += `(-) Impostos sobre Venda,${dre.taxSalesValue.toFixed(2)},${dre.percentages.taxSales.toFixed(2)}%\n`;
        csv += `(-) Cancelamentos,${dre.cancellationsValue.toFixed(2)},${dre.percentages.cancellations.toFixed(2)}%\n`;
        csv += `(-) Devoluções,${dre.returnsValue.toFixed(2)},${dre.percentages.returns.toFixed(2)}%\n`;
        csv += `(-) Taxas de Plataforma,${dre.platformFeeValue.toFixed(2)},${dre.percentages.platformFee.toFixed(2)}%\n`;
        csv += `RECEITA LÍQUIDA,${dre.netRevenue.toFixed(2)},${dre.percentages.netRevenue.toFixed(2)}%\n`;
        csv += `(-) CMV,${dre.totalCMV.toFixed(2)},${dre.percentages.totalCMV.toFixed(2)}%\n`;
        csv += `LUCRO BRUTO,${dre.grossProfit.toFixed(2)},${dre.percentages.grossProfit.toFixed(2)}%\n`;
        csv += `(-) Despesas Operacionais,${dre.totalOperationalExpenses.toFixed(2)},${dre.percentages.operationalExpenses.toFixed(2)}%\n`;
        csv += `RESULTADO OPERACIONAL,${dre.operationalResult.toFixed(2)},${dre.percentages.operationalResult.toFixed(2)}%\n`;
        csv += `(-) Despesas Financeiras,${dre.financialExpenses.toFixed(2)},${dre.percentages.financialExpenses.toFixed(2)}%\n`;
        csv += `LUCRO ANTES DOS IMPOSTOS,${dre.profitBeforeTax.toFixed(2)},${dre.percentages.profitBeforeTax.toFixed(2)}%\n`;
        csv += `(-) IRPJ,${dre.irpjValue.toFixed(2)},${(dre.irpjValue / (dre.grossRevenue || 1) * 100).toFixed(2)}%\n`;
        csv += `(-) CSLL,${dre.csllValue.toFixed(2)},${(dre.csllValue / (dre.grossRevenue || 1) * 100).toFixed(2)}%\n`;
        csv += `LUCRO LÍQUIDO,${dre.netProfit.toFixed(2)},${dre.percentages.netProfit.toFixed(2)}%\n\n`;

        csv += `INDICADORES DE PERFORMANCE\n`;
        csv += `Margem Líquida,${dre.netMargin.toFixed(2)}%\n`;
        csv += `Margem Bruta,${dre.grossMargin.toFixed(2)}%\n`;
        csv += `Margem Operacional,${dre.operationalMargin.toFixed(2)}%\n`;
        csv += `Ponto de Equilíbrio,${dre.breakeven} unidades\n`;
        csv += `Lucro por Unidade,R$ ${(dre.netProfit / dre.quantity).toFixed(2)}\n`;

        // Adiciona validações se houver erros
        if (dreState.validationErrors.length > 0) {
            csv += `\nAVISOS:\n`;
            dreState.validationErrors.forEach(error => {
                csv += `${error}\n`;
            });
        }

        // Nome do arquivo seguro
        const safeProductName = productName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const fileName = `dre_${safeProductName}_${date.replace(/\//g, '-')}.csv`;

        downloadCSV(csv, fileName);
        showAlert('Relatório DRE exportado com sucesso!', 'success');
        
    } catch (error) {
        console.error('Erro ao exportar DRE:', error);
        showAlert('Erro ao exportar relatório', 'error');
    }
}

// Exporta relatório DRE em PDF (placeholder)
function exportDREPDF() {
    showAlert('Exportação PDF em desenvolvimento', 'info');
    // Implementar usando biblioteca como jsPDF ou html2pdf.js
}

// Inicializa eventos do módulo DRE
function initializeDREEvents() {
    try {
        // Eventos de input (com debounce para otimização)
        const inputIds = [
            'dreProductSelect', 'dreMarkup', 'dreQuantity', 'dreTaxSales',
            'dreCancellations', 'dreReturns', 'drePlatformFee', 'dreRentUtilities',
            'dreSalaries', 'dreMarketing', 'dreOtherExpenses', 'dreFinancialExpenses',
            'dreIRPJ', 'dreCSLL'
        ];

        inputIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', updateDRESimulation);
                element.addEventListener('input', debounce(updateDRESimulation, 500));
            }
        });

        // Eventos de botões
        const buttonEvents = [
            { id: 'dreApplyTaxRegime', fn: applyTaxRegime },
            { id: 'dreLoadCosts', fn: loadOperationalCostsToDRE },
            { id: 'dreExportCSV', fn: exportDRECSV },
            { id: 'dreExportPDF', fn: exportDREPDF }
        ];

        buttonEvents.forEach(({ id, fn }) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('click', fn);
            }
        });

        // Evento de regime tributário
        const taxRegimeSelect = document.getElementById('dreTaxRegime');
        if (taxRegimeSelect) {
            taxRegimeSelect.addEventListener('change', applyTaxRegime);
        }

        console.log('Eventos DRE inicializados com sucesso');
    } catch (error) {
        console.error('Erro ao inicializar eventos DRE:', error);
    }
}

// Função debounce para otimização
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Função auxiliar para download de CSV
function downloadCSV(content, fileName) {
    try {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Erro ao fazer download do CSV:', error);
        throw error;
    }
}

// Inicializa quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    try {
        initializeDREModule();
        initializeDREEvents();
        console.log('Módulo DRE carregado com sucesso');
    } catch (error) {
        console.error('Falha ao carregar módulo DRE:', error);
    }
});

// Exporta funções principais para uso global
window.DREModule = {
    calculate: calculateDRE,
    update: updateDRESimulation,
    exportCSV: exportDRECSV,
    exportPDF: exportDREPDF,
    applyTaxRegime: applyTaxRegime,
    loadCosts: loadOperationalCostsToDRE,
    getState: () => ({ ...dreState }),
    clearHistory: () => { dreState.simulationHistory = []; },
    validateInputs: validateDREInputs
};

// ==================== FUNÇÕES AUXILIARES NECESSÁRIAS ====================

// Função showAlert (caso não exista)
if (typeof showAlert !== 'function') {
    function showAlert(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
        // Implementação básica - pode ser substituída por uma biblioteca de notificações
        alert(`${type.toUpperCase()}: ${message}`);
    }
}

// Variáveis globais necessárias (exemplo de dados para testes)
if (typeof pizzas === 'undefined') {
    // Dados de exemplo para testes
    window.pizzas = [
        { id: 1, name: 'Pizza Margherita', totalCost: 15.50 },
        { id: 2, name: 'Pizza Pepperoni', totalCost: 18.75 },
        { id: 3, name: 'Pizza Quatro Queijos', totalCost: 22.30 }
    ];
}

if (typeof operationalCosts === 'undefined') {
    // Dados de exemplo para testes
    window.operationalCosts = {
        rent: 2000,
        electricity: 500,
        water: 200,
        gas: 300,
        internet: 100,
        salaries: 5000,
        marketing: 500,
        cleaning: 200,
        bankFees: 100,
        others: 200
    };
}

// ==================== HTML DE EXEMPLO (para teste rápido) ====================
/*
Para testar rapidamente, adicione este HTML ao seu documento:

<div id="dreModule" class="p-6 bg-white rounded-lg shadow-lg">
    <h2 class="text-2xl font-bold mb-6 text-gray-800">📊 Módulo de Precificação e DRE</h2>
    
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <!-- Painel de Configuração -->
        <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 class="text-lg font-semibold mb-4">⚙️ Configuração</h3>
            
            <div class="space-y-4">
                <!-- Seleção de Produto -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Produto</label>
                    <select id="dreProductSelect" class="w-full p-2 border border-gray-300 rounded-md">
                        <option value="">Selecione uma pizza...</option>
                    </select>
                </div>
                
                <!-- Parâmetros de Precificação -->
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Markup (%)</label>
                        <input type="number" id="dreMarkup" value="100" class="w-full p-2 border border-gray-300 rounded-md">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
                        <input type="number" id="dreQuantity" value="100" class="w-full p-2 border border-gray-300 rounded-md">
                    </div>
                </div>
                
                <!-- Regime Tributário -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Regime Tributário</label>
                    <select id="dreTaxRegime" class="w-full p-2 border border-gray-300 rounded-md">
                        <option value="custom">Personalizado</option>
                        <option value="simples">Simples Nacional</option>
                        <option value="presumido">Lucro Presumido</option>
                        <option value="real">Lucro Real</option>
                    </select>
                </div>
            </div>
        </div>
        
        <!-- Painel de Resultados -->
        <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 class="text-lg font-semibold mb-4">💰 Precificação</h3>
            
            <div class="space-y-3">
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">CMV Unitário:</span>
                    <span id="dreCMVDisplay" class="font-semibold">R$ 0.00</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">Markup Aplicado:</span>
                    <span id="dreMarkupDisplay" class="font-semibold">0.00x</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">Preço de Venda:</span>
                    <span id="dreSalePriceDisplay" class="font-semibold text-green-600">R$ 0.00</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">Lucro por Unidade:</span>
                    <span id="dreGrossProfitUnit" class="font-semibold text-green-600">R$ 0.00</span>
                </div>
            </div>
        </div>
    </div>
    
    <!-- Tabela DRE -->
    <div class="mb-6">
        <h3 class="text-lg font-semibold mb-4">📋 Demonstração do Resultado do Exercício</h3>
        <div class="overflow-x-auto">
            <table class="min-w-full bg-white border border-gray-200">
                <thead class="bg-gray-100">
                    <tr>
                        <th class="py-3 px-4 text-left font-semibold text-gray-700">Descrição</th>
                        <th class="py-3 px-4 text-right font-semibold text-gray-700">Valor (R$)</th>
                        <th class="py-3 px-4 text-right font-semibold text-gray-700">% s/ Receita Bruta</th>
                        <th class="py-3 px-4 text-center font-semibold text-gray-700">Impacto</th>
                    </tr>
                </thead>
                <tbody id="dreTableBody">
                    <!-- Preenchido dinamicamente -->
                </tbody>
            </table>
        </div>
    </div>
    
    <!-- Botões de Ação -->
    <div class="flex flex-wrap gap-3 mb-6">
        <button id="dreApplyTaxRegime" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            Aplicar Regime
        </button>
        <button id="dreLoadCosts" class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
            Carregar Custos do Sistema
        </button>
        <button id="dreExportCSV" class="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700">
            Exportar CSV
        </button>
        <button id="dreExportPDF" class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
            Exportar PDF
        </button>
    </div>
</div>
*/