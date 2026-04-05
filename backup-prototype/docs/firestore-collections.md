# Firestore Collection Structure

Bu proje Step 1'de var oldugu varsayilan malzeme yonetimi yapisini korur ve asagidaki koleksiyonlar ile genisler.

## Step 1: Material Management (korunan yapi)

### `parts`

- `part_number`
- `part_name`
- `category`
- `subcategory`
- `unit`
- `default_quantity`
- `material`
- `material_standard`
- `upper_tolerance`
- `lower_tolerance`
- `surface_treatment`
- `hardness`
- `weight`
- `dimensions_ctq`
- `critical_stock_quantity`
- `minimum_stock_level`
- `created_at`
- `updated_at`

### `part_revisions`

- `part_id`
- `revision_code`
- `drawing_pdf_path`
- `description`
- `created_at`
- `updated_at`

### `models`

- `model_name`
- `description`
- `created_at`
- `updated_at`

### `bom_items`

- `model_id`
- `part_id`
- `quantity`
- `created_at`
- `updated_at`

## Step 2: Purchasing

### `suppliers`

- `name`
- `contact_email`
- `contact_phone`
- `contact_person`
- `created_at`
- `updated_at`

### `purchase_requests`

- `part_id`
- `quantity`
- `request_date`
- `description`
- `status` (`pending`, `approved`, `rejected`)
- `created_at`
- `updated_at`

### `purchase_orders`

- `supplier_id`
- `purchase_request_id`
- `order_date`
- `status` (`created`, `sent`, `received`, `cancelled`)
- `items[]`
- `items[].part_id`
- `items[].quantity`
- `items[].received_quantity`
- `items[].unit_price`
- `items[].line_total`
- `total_amount`
- `created_at`
- `updated_at`

### `goods_receipts`

- `purchase_order_id`
- `supplier_id`
- `part_id`
- `received_quantity`
- `lot_number`
- `warehouse_id`
- `location_id`
- `receipt_date`
- `qc_status` (`pending`, `accepted`, `rejected`, `conditional`)
- `created_at`
- `updated_at`

## Step 3: Quality

### `quality_plans`

- `part_id`
- `criteria`
- `upper_tolerance`
- `lower_tolerance`
- `measurement_method`
- `notes`
- `created_at`
- `updated_at`

### `quality_records`

- `inspection_type` (`incoming`, `in_process`, `final`)
- `part_id`
- `goods_receipt_id`
- `operation_name`
- `result` (`accepted`, `rejected`, `conditional`)
- `inspection_date`
- `measurement_data`
- `notes`
- `nonconformity_id`
- `created_at`
- `updated_at`

### `nonconformities`

- `part_id`
- `source_type`
- `source_id`
- `description`
- `action` (`rework`, `scrap`, `accept`)
- `status`
- `created_at`
- `updated_at`

## Step 4: Warehouse

### `warehouses`

- `code`
- `name`
- `description`
- `created_at`
- `updated_at`

### `locations`

- `warehouse_id`
- `code`
- `name`
- `description`
- `created_at`
- `updated_at`

### `inventory_lots` (destekleyici koleksiyon)

- `item_type` (`part`, `model`)
- `item_id`
- `lot_number`
- `warehouse_id`
- `location_id`
- `on_hand_quantity`
- `available_quantity`
- `quarantine_quantity`
- `rejected_quantity`
- `created_at`
- `updated_at`

### `stock_movements`

- `movement_type`
- `item_type`
- `item_id`
- `quantity`
- `lot_number`
- `warehouse_id`
- `location_id`
- `from_location_id`
- `to_location_id`
- `reference_type`
- `reference_id`
- `note`
- `created_at`
- `updated_at`

## Step 5: Sales

### `customers`

- `company_name`
- `contact_person`
- `contact_email`
- `contact_phone`
- `created_at`
- `updated_at`

### `sales_orders`

- `customer_id`
- `model_id`
- `quantity`
- `due_date`
- `status` (`created`, `confirmed`, `in_production`, `shipped`, `completed`)
- `shipped_quantity`
- `created_at`
- `updated_at`

### `shipments`

- `sales_order_id`
- `model_id`
- `quantity`
- `ship_date`
- `lot_number`
- `warehouse_id`
- `location_id`
- `created_at`
- `updated_at`

## Step 6: Production

### `production_orders`

- `model_id`
- `quantity`
- `planned_date`
- `status` (`pending`, `in_progress`, `completed`)
- `bom_snapshot[]`
- `bom_snapshot[].part_id`
- `bom_snapshot[].quantity_per`
- `bom_snapshot[].required_quantity`
- `good_quantity`
- `scrap_quantity`
- `operator_id`
- `started_at`
- `completed_at`
- `created_at`
- `updated_at`

### `production_logs`

- `production_order_id`
- `log_type` (`start`, `complete`)
- `operator_id`
- `material_allocations[]`
- `lot_number`
- `warehouse_id`
- `location_id`
- `good_quantity`
- `scrap_quantity`
- `created_at`
- `updated_at`

## Security / Audit

### `users`

- `full_name`
- `email`
- `role` (`admin`, `engineer`, `operator`)
- `created_at`
- `updated_at`

### `logs`

- `user_id`
- `action`
- `entity_type`
- `entity_id`
- `details`
- `created_at`
- `updated_at`

## Is Kural Ozeti

- Part ve revision kayitlari silinmez.
- Goods receipt yalnizca purchase order uzerinden olusur.
- Gelen miktar siparis kaleminin kalan miktarini asamaz.
- Incoming QC kabul edilmeden malzeme `available_quantity` alanina gecmez.
- Negatif stok olusamaz.
- Lot takibi zorunludur.
- Tum hareketler `stock_movements` ve `logs` ile izlenir.
