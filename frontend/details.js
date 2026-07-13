document.addEventListener('DOMContentLoaded', async () => {
    const groupId = new URLSearchParams(window.location.search).get('group_id');
    const loadingEl = document.getElementById('loading');
    const contentContainer = document.getElementById('content-container');
    const errorContainer = document.getElementById('error-container');

    if (!groupId) {
        showError("Missing Strategy Group ID.");
        return;
    }

    try {
        // Fetch all positions (Open and Closed) to find the group
        const [openRes, closedRes] = await Promise.all([
            fetch('api/positions?status=Open'),
            fetch('api/positions?status=Closed')
        ]);

        if (!openRes.ok || !closedRes.ok) throw new Error("API failure");

        const openData = await openRes.json();
        const closedData = await closedRes.json();
        const allPositions = [...(openData.positions || []), ...(closedData.positions || [])];

        const group = allPositions.filter(p => p.group_id === groupId);

        if (group.length === 0) {
            showError("Strategy group not found.");
            return;
        }

        renderDetails(group);
    } catch (err) {
        console.error(err);
        showError("Failed to load strategy details.");
    } finally {
        loadingEl.style.display = 'none';
    }

    function showError(msg) {
        loadingEl.style.display = 'none';
        contentContainer.style.display = 'none';
        errorContainer.style.display = 'block';
        document.getElementById('error-text').textContent = msg;
    }

    function formatCurrency(num) {
        if (num === null || num === undefined || isNaN(num)) return '0.00';
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num);
    }

    function formatDate(dateStr) {
        if (!dateStr) return '-';
        return dateStr.split('T')[0];
    }



    async function fetchCurrentPrices() {
        const symbols = new Set();
        document.querySelectorAll('.price-val').forEach(el => {
            symbols.add(el.dataset.symbol);
        });

        if (symbols.size === 0) return;

        try {
            const response = await fetch(`api/prices?symbols=${Array.from(symbols).join(',')}`);
            if (!response.ok) return;
            const prices = await response.json();

            document.querySelectorAll('#table-legs tr').forEach(row => {
                const priceEl = row.querySelector('.price-val');
                const riskEl = row.querySelector('.risk-status');
                if (!priceEl || !riskEl) return;

                const symbol = priceEl.dataset.symbol;
                const currentPrice = prices[symbol];
                const strike = parseFloat(riskEl.dataset.strike);
                const cp = riskEl.dataset.cp;

                if (currentPrice !== undefined) {
                    priceEl.textContent = formatCurrency(currentPrice);
                    
                    let distance = 0;
                    let isITM = false;

                    if (cp === 'Call') {
                        isITM = currentPrice > strike;
                        distance = ((currentPrice - strike) / strike) * 100;
                    } else {
                        isITM = currentPrice < strike;
                        distance = ((strike - currentPrice) / strike) * 100;
                    }

                    const statusText = isITM ? 'ITM 🔴' : 'OTM 🟢';
                    riskEl.innerHTML = ` | ${statusText} <span style="font-size: 0.8rem; font-weight: normal; color: #94a3b8;">(${Math.abs(distance).toFixed(2)}%)</span>`;
                } else {
                    priceEl.textContent = 'Unavailable';
                    riskEl.textContent = '';
                }
            });
        } catch (error) {
            console.error('Error fetching prices:', error);
        }
    }

    function renderDetails(group) {
        const firstPos = group[0];
        const isClosed = group.every(p => p.status === 'Closed');
        
        // Update Title and IDs
        document.getElementById('page-title').textContent = `${firstPos.symbol} Strategy Details`;
        document.getElementById('group-id-text').textContent = `ID: ${firstPos.group_id}`;

        // Summary Stats
        const statStatus = document.getElementById('stat-status');
        statStatus.textContent = isClosed ? 'CLOSED' : 'OPEN';
        statStatus.style.color = isClosed ? '#94a3b8' : 'var(--success-color)';

        let totalNetUsd = 0;
        const maxRiskVal = firstPos.max_loss || 0;

        if (isClosed) {
            totalNetUsd = group.reduce((sum, p) => sum + p.realized_pnl_usd, 0);
            
            const openPremium = group.reduce((sum, pos) => {
                const openTrans = pos.transactions.filter(t => t.transaction_type === 'BTO' || t.transaction_type === 'STO');
                return sum + openTrans.reduce((s, t) => s + t.total_usd, 0);
            }, 0);
            
            const costPct = maxRiskVal > 0 ? (openPremium / maxRiskVal) * 100 : 0;
            const costPctText = costPct !== 0 ? ` <span style="font-size: 0.85rem; font-weight: normal; color: #94a3b8;">(${costPct >= 0 ? '+' : ''}${costPct.toFixed(2)}%)</span>` : '';

            document.getElementById('label-pnl').textContent = 'Net Cost (Potential Max Returns)';
            const pnlEl = document.getElementById('stat-pnl');
            pnlEl.innerHTML = `${formatCurrency(openPremium)}${costPctText}`;
            pnlEl.className = 'stat-value';
            
            const pnlPct = Math.abs(openPremium) > 0 ? (totalNetUsd / Math.abs(openPremium)) * 100 : 0;
            const pnlPctText = pnlPct !== 0 ? ` (${totalNetUsd >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)` : '';
            const pnlSign = totalNetUsd > 0 ? '+' : '';
            
            const realizedPnlEl = document.getElementById('stat-realized-pnl');
            realizedPnlEl.textContent = `${pnlSign}${formatCurrency(totalNetUsd)}${pnlPctText}`;
            realizedPnlEl.className = `stat-value ${totalNetUsd >= 0 ? 'pnl-positive' : 'pnl-negative'}`;
            
            document.getElementById('card-realized-pnl').style.display = 'block';
        } else {
            totalNetUsd = group.reduce((sum, p) => sum + p.total_cost_usd, 0);
            document.getElementById('label-pnl').textContent = 'Net Cost (USD)';
            
            const costPct = maxRiskVal > 0 ? (totalNetUsd / maxRiskVal) * 100 : 0;
            const costPctText = costPct !== 0 ? ` <span style="font-size: 0.85rem; font-weight: normal; color: #94a3b8;">(${totalNetUsd >= 0 ? '+' : ''}${costPct.toFixed(2)}%)</span>` : '';

            const pnlEl = document.getElementById('stat-pnl');
            pnlEl.innerHTML = `${formatCurrency(totalNetUsd)}${costPctText}`;
            pnlEl.className = `stat-value ${totalNetUsd >= 0 ? 'pnl-positive' : 'pnl-negative'}`;
            
            document.getElementById('card-realized-pnl').style.display = 'none';
        }

        document.getElementById('stat-risk').textContent = firstPos.max_loss > 0 ? formatCurrency(firstPos.max_loss) : '-';

        // IB Unrealized P/L calculation and rendering
        const groupIbUnrealized = group.reduce((sum, p) => sum + (p.ib_unrealized_profits || 0), 0);
        const groupHasIbData = group.some(p => p.ib_unrealized_profits !== null && p.ib_unrealized_profits !== undefined);

        if (groupHasIbData && !isClosed) {
            const ibPct = Math.abs(totalNetUsd) > 0 ? (groupIbUnrealized / Math.abs(totalNetUsd)) * 100 : 0;
            const ibPctText = ibPct !== 0 ? ` (${groupIbUnrealized >= 0 ? '+' : ''}${ibPct.toFixed(2)}%)` : '';
            const ibSign = groupIbUnrealized > 0 ? '+' : '';
            
            const ibPnlEl = document.getElementById('stat-ib-pnl');
            ibPnlEl.textContent = `${ibSign}${formatCurrency(groupIbUnrealized)}${ibPctText}`;
            ibPnlEl.className = `stat-value ${groupIbUnrealized >= 0 ? 'pnl-positive' : 'pnl-negative'}`;
            
            document.getElementById('card-ib-pnl').style.display = 'block';
        } else {
            document.getElementById('card-ib-pnl').style.display = 'none';
        }
        
        // Expiration and Days to Expiration
        const expDateStr = firstPos.expiration_date;
        const expEl = document.getElementById('stat-expiration');
        if (expDateStr) {
            const expDate = new Date(expDateStr);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const diffTime = expDate - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            let dteStr = '';
            if (isClosed) {
                dteStr = ''; // Don't show DTE for closed strategies
            } else if (diffDays < 0) {
                dteStr = ' (Expired)';
            } else if (diffDays === 0) {
                dteStr = ' (Today)';
            } else {
                dteStr = ` (${diffDays}d)`;
            }
            
            expEl.textContent = formatDate(expDateStr) + dteStr;
        } else {
            expEl.textContent = '-';
        }

        document.getElementById('stat-multiplier').textContent = firstPos.multiplier || 100;

        // Calculate Breakeven
        let breakeven = 0;
        const multiplier = firstPos.multiplier || 100;
        const initialQty = group[0].transactions
            .filter(t => t.transaction_type === 'BTO' || t.transaction_type === 'STO')
            .reduce((sum, t) => sum + t.quantity, 0);
        
        const netPremiumPerShare = Math.abs(totalNetUsd / multiplier / initialQty);

        if (group.length === 1) {
            const pos = group[0];
            if (pos.initial_type === 'STO' && pos.call_put === 'Put') breakeven = pos.strike_price - netPremiumPerShare;
            else if (pos.initial_type === 'BTO' && pos.call_put === 'Put') breakeven = pos.strike_price - netPremiumPerShare;
            else if (pos.initial_type === 'STO' && pos.call_put === 'Call') breakeven = pos.strike_price + netPremiumPerShare;
            else if (pos.initial_type === 'BTO' && pos.call_put === 'Call') breakeven = pos.strike_price + netPremiumPerShare;
        } else if (group.length === 2) {
            const stoLeg = group.find(p => p.initial_type === 'STO');
            const btoLeg = group.find(p => p.initial_type === 'BTO');
            if (stoLeg && btoLeg) {
                const isCredit = totalNetUsd > 0;
                if (isCredit) {
                    if (stoLeg.call_put === 'Put') breakeven = stoLeg.strike_price - netPremiumPerShare;
                    else breakeven = stoLeg.strike_price + netPremiumPerShare;
                } else {
                    if (btoLeg.call_put === 'Put') breakeven = btoLeg.strike_price - netPremiumPerShare;
                    else breakeven = btoLeg.strike_price + netPremiumPerShare;
                }
            }
        }
        document.getElementById('stat-breakeven').textContent = breakeven > 0 ? breakeven.toFixed(2) : '-';

        // Cash Required for Short Puts
        let totalCashRequired = 0;
        group.forEach(pos => {
            if (pos.initial_type === 'STO' && pos.call_put === 'Put' && pos.status === 'Open') {
                totalCashRequired += (pos.strike_price * (pos.multiplier || 100) * pos.current_quantity);
            }
        });

        const cashCard = document.getElementById('card-cash-required');
        if (totalCashRequired > 0) {
            cashCard.style.display = 'block';
            document.getElementById('stat-cash-required').textContent = formatCurrency(totalCashRequired);
        } else {
            cashCard.style.display = 'none';
        }

        // Render Active Legs Table
        const legsBody = document.querySelector('#table-legs tbody');
        legsBody.innerHTML = '';
        const activeLegs = group.filter(p => p.status === 'Open');

        activeLegs.forEach(pos => {
            const tr = document.createElement('tr');
            
            const ibPriceText = pos.ib_current_price !== null && pos.ib_current_price !== undefined 
                ? formatCurrency(pos.ib_current_price) 
                : '-';
            
            let ibPnlText = '-';
            let ibPnlClass = '';
            if (pos.ib_unrealized_profits !== null && pos.ib_unrealized_profits !== undefined) {
                const sign = pos.ib_unrealized_profits > 0 ? '+' : '';
                ibPnlText = `${sign}${formatCurrency(pos.ib_unrealized_profits)}`;
                ibPnlClass = pos.ib_unrealized_profits >= 0 ? 'pnl-positive' : 'pnl-negative';
            }
            
            const occ = pos.occ_symbol || '';
            tr.innerHTML = `
                <td data-label="Contract Name">
                    <div style="font-weight: 500;">${pos.contract_name}</div>
                    <div style="font-size: 0.8rem; font-family: monospace; color: #64748b; margin-top: 2px;">${occ}</div>
                </td>
                <td data-label="Net Qty">${pos.current_quantity}</td>
                <td data-label="Type">${pos.initial_type}</td>
                <td class="risk-combined-cell" data-label="Underlying / Risk">
                    <span class="price-val" data-symbol="${pos.symbol}">Loading...</span>
                    <span class="risk-status" data-strike="${pos.strike_price}" data-cp="${pos.call_put}"></span>
                </td>
                <td class="${pos.total_cost_usd >= 0 ? 'pnl-positive' : 'pnl-negative'}" data-label="Total Cost/Credit">${formatCurrency(pos.total_cost_usd)}</td>
                <td data-label="Current Price (IB)">${ibPriceText}</td>
                <td class="${ibPnlClass}" data-label="Unrealized P/L (IB)">${ibPnlText}</td>
            `;
            legsBody.appendChild(tr);
        });

        if (activeLegs.length > 0) {
            fetchCurrentPrices();
        }

        // Render Transaction History
        const transBody = document.querySelector('#table-transactions tbody');
        transBody.innerHTML = '';
        
        // Flatten and sort transactions
        const allTransactions = group.flatMap(p => {
            const occ = p.occ_symbol || '';
            return p.transactions.map(t => ({ ...t, contract: p.contract_name, occ: occ }));
        }).sort((a, b) => new Date(a.date) - new Date(b.date));

        allTransactions.forEach(t => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="Date">${formatDate(t.date)}</td>
                <td data-label="Action"><span class="badge ${t.transaction_type}">${t.transaction_type}</span></td>
                <td data-label="Contract">
                    <div style="font-weight: 500;">${t.contract}</div>
                    <div style="font-size: 0.8rem; font-family: monospace; color: #64748b; margin-top: 2px;">${t.occ}</div>
                </td>
                <td data-label="Qty">${t.quantity}</td>
                <td data-label="Price">${formatCurrency(t.option_price)}</td>
                <td data-label="Commission">${formatCurrency(t.commission)}</td>
                <td class="${t.total_usd >= 0 ? 'pnl-positive' : 'pnl-negative'}" data-label="Total (USD)">${formatCurrency(t.total_usd)}</td>
            `;
            transBody.appendChild(tr);
        });
    }
});
