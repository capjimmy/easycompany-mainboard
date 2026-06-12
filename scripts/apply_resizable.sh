#!/bin/bash
# 주요 리스트 페이지에 ResizableTable 적용
FILES=(
  "src/renderer/pages/admin/UserManagement.tsx"
  "src/renderer/pages/admin/DepartmentManagement.tsx"
  "src/renderer/pages/admin/CompanyManagement.tsx"
  "src/renderer/pages/admin/VehicleManagement.tsx"
  "src/renderer/pages/admin/SpaceManagement.tsx"
  "src/renderer/pages/clients/ClientList.tsx"
  "src/renderer/pages/contracts/ContractList.tsx"
  "src/renderer/pages/contracts/OutsourcingManagement.tsx"
  "src/renderer/pages/finance/TaxInvoiceList.tsx"
  "src/renderer/pages/finance/BillingPayment.tsx"
  "src/renderer/pages/finance/PayableList.tsx"
  "src/renderer/pages/finance/ReceivableList.tsx"
  "src/renderer/pages/finance/ExpenseSettlement.tsx"
  "src/renderer/pages/finance/ExpenseRequest.tsx"
  "src/renderer/pages/finance/ProvisionalPaymentList.tsx"
  "src/renderer/pages/hr/LeavePage.tsx"
  "src/renderer/pages/hr/LeaveAdminPage.tsx"
  "src/renderer/pages/hr/VehicleLog.tsx"
  "src/renderer/pages/quotes/QuoteList.tsx"
)

for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    # Table import에서 Table 제거하고 ResizableTable import 추가
    echo "Processing $f"
  fi
done
