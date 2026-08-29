-- VedicUpchar MySQL Schema (converted from Postgres)
-- Charset: utf8mb4 for Hindi + emoji support
SET NAMES utf8mb4;

-- ==================== announcements ====================
DROP TABLE IF EXISTS `announcements`;
CREATE TABLE `announcements` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `message` TEXT NOT NULL,
  `message_hi` TEXT,
  `link` TEXT,
  `bg_color` TEXT DEFAULT '#0F172A',
  `text_color` TEXT DEFAULT '#FFFFFF',
  `is_active` TINYINT(1) DEFAULT true,
  `sort_order` INT DEFAULT 0,
  `starts_at` DATETIME,
  `ends_at` DATETIME,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP
,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== banners ====================
DROP TABLE IF EXISTS `banners`;
CREATE TABLE `banners` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `title` TEXT NOT NULL,
  `subtitle` TEXT,
  `cta_text` TEXT,
  `cta_link` TEXT,
  `bg_color` TEXT,
  `image_url` TEXT,
  `section` TEXT DEFAULT 'hero',
  `sort_order` INT DEFAULT 0,
  `is_active` TINYINT(1) DEFAULT true,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== blogs ====================
DROP TABLE IF EXISTS `blogs`;
CREATE TABLE `blogs` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `title` TEXT NOT NULL,
  `title_hi` TEXT,
  `slug` TEXT NOT NULL,
  `content` TEXT,
  `content_hi` TEXT,
  `excerpt` TEXT,
  `excerpt_hi` TEXT,
  `image_url` TEXT,
  `category` TEXT,
  `tags` LONGTEXT,
  `meta_title` TEXT,
  `meta_description` TEXT,
  `is_published` TINYINT(1) DEFAULT false,
  `author` TEXT,
  `views_count` INT DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `images` LONGTEXT
,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== categories ====================
DROP TABLE IF EXISTS `categories`;
CREATE TABLE `categories` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `name` TEXT NOT NULL,
  `name_hi` TEXT,
  `slug` TEXT NOT NULL,
  `description` TEXT,
  `icon` TEXT,
  `parent_id` CHAR(36),
  `sort_order` INT DEFAULT 0,
  `is_active` TINYINT(1) DEFAULT true,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `discount_percentage` DECIMAL(12,2) DEFAULT 0,
  `sale_starts_at` DATETIME,
  `sale_ends_at` DATETIME
,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== consultations ====================
DROP TABLE IF EXISTS `consultations`;
CREATE TABLE `consultations` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `patient_name` TEXT NOT NULL,
  `mobile` TEXT NOT NULL,
  `city` TEXT,
  `disease` TEXT,
  `gender` TEXT,
  `consultation_type` TEXT,
  `consultation_date` TEXT,
  `consultation_time` TEXT,
  `status` TEXT DEFAULT 'pending',
  `notes` TEXT,
  `age` TEXT,
  `prescription_note` TEXT,
  `file_urls` LONGTEXT,
  `user_id` CHAR(36),
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== contact_inquiries ====================
DROP TABLE IF EXISTS `contact_inquiries`;
CREATE TABLE `contact_inquiries` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `name` TEXT NOT NULL,
  `email` TEXT,
  `phone` TEXT,
  `subject` TEXT,
  `message` TEXT NOT NULL,
  `status` TEXT NOT NULL DEFAULT 'new',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP
,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== coupons ====================
DROP TABLE IF EXISTS `coupons`;
CREATE TABLE `coupons` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `code` TEXT NOT NULL,
  `discount_type` TEXT DEFAULT 'percentage',
  `discount_value` DECIMAL(12,2) DEFAULT 0,
  `min_order_value` DECIMAL(12,2) DEFAULT 0,
  `max_uses` INT,
  `used_count` INT DEFAULT 0,
  `is_active` TINYINT(1) DEFAULT true,
  `valid_from` DATETIME,
  `valid_until` DATETIME,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP
,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== email_send_log ====================
DROP TABLE IF EXISTS `email_send_log`;
CREATE TABLE `email_send_log` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `message_id` TEXT,
  `template_name` TEXT NOT NULL,
  `recipient_email` TEXT NOT NULL,
  `status` TEXT NOT NULL,
  `error_message` TEXT,
  `metadata` LONGTEXT,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== email_send_state ====================
DROP TABLE IF EXISTS `email_send_state`;
CREATE TABLE `email_send_state` (
  `id` INT NOT NULL DEFAULT 1,
  `retry_after_until` DATETIME,
  `batch_size` INT NOT NULL DEFAULT 10,
  `send_delay_ms` INT NOT NULL DEFAULT 200,
  `auth_email_ttl_minutes` INT NOT NULL DEFAULT 15,
  `transactional_email_ttl_minutes` INT NOT NULL DEFAULT 60,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== email_unsubscribe_tokens ====================
DROP TABLE IF EXISTS `email_unsubscribe_tokens`;
CREATE TABLE `email_unsubscribe_tokens` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `token` TEXT NOT NULL,
  `email` TEXT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `used_at` DATETIME
,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== impact_stats ====================
DROP TABLE IF EXISTS `impact_stats`;
CREATE TABLE `impact_stats` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `label` TEXT NOT NULL,
  `label_hi` TEXT,
  `value` TEXT NOT NULL,
  `icon` TEXT,
  `sort_order` INT DEFAULT 0,
  `is_active` TINYINT(1) DEFAULT true,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== lead_events ====================
DROP TABLE IF EXISTS `lead_events`;
CREATE TABLE `lead_events` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `user_id` CHAR(36),
  `event_type` TEXT NOT NULL,
  `name` TEXT,
  `phone` TEXT,
  `email` TEXT,
  `city` TEXT,
  `note` TEXT,
  `status` TEXT NOT NULL DEFAULT 'new',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== media_logos ====================
DROP TABLE IF EXISTS `media_logos`;
CREATE TABLE `media_logos` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `name` TEXT NOT NULL,
  `image_url` TEXT,
  `link` TEXT,
  `sort_order` INT DEFAULT 0,
  `is_active` TINYINT(1) DEFAULT true,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== newsletter_subscribers ====================
DROP TABLE IF EXISTS `newsletter_subscribers`;
CREATE TABLE `newsletter_subscribers` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `email` TEXT NOT NULL,
  `name` TEXT,
  `is_active` TINYINT(1) DEFAULT true,
  `source` TEXT DEFAULT 'website',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== offers ====================
DROP TABLE IF EXISTS `offers`;
CREATE TABLE `offers` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `title` TEXT NOT NULL,
  `title_hi` TEXT,
  `description` TEXT,
  `discount_type` TEXT,
  `discount_value` DECIMAL(12,2),
  `coupon_code` TEXT,
  `min_order_value` DECIMAL(12,2),
  `is_active` TINYINT(1) DEFAULT true,
  `valid_from` DATETIME,
  `valid_until` DATETIME,
  `sort_order` INT DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP
,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== order_items ====================
DROP TABLE IF EXISTS `order_items`;
CREATE TABLE `order_items` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `order_id` CHAR(36) NOT NULL,
  `product_id` CHAR(36),
  `product_name` TEXT NOT NULL,
  `quantity` INT DEFAULT 1,
  `price` DECIMAL(12,2) DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== order_sequence ====================
DROP TABLE IF EXISTS `order_sequence`;
CREATE TABLE `order_sequence` (
  `date_key` VARCHAR(32) NOT NULL,
  `counter` INT DEFAULT 0
,
  PRIMARY KEY (`date_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== orders ====================
DROP TABLE IF EXISTS `orders`;
CREATE TABLE `orders` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `user_id` CHAR(36),
  `order_number` TEXT,
  `customer_name` TEXT NOT NULL,
  `customer_email` TEXT,
  `customer_phone` TEXT NOT NULL,
  `address` TEXT NOT NULL,
  `city` TEXT,
  `state` TEXT,
  `pincode` TEXT,
  `total` DECIMAL(12,2) DEFAULT 0,
  `subtotal` DECIMAL(12,2),
  `discount` DECIMAL(12,2) DEFAULT 0,
  `shipping` DECIMAL(12,2) DEFAULT 0,
  `status` TEXT DEFAULT 'pending',
  `payment_status` TEXT DEFAULT 'pending',
  `payment_method` TEXT,
  `payment_id` TEXT,
  `notes` TEXT,
  `tracking_id` TEXT,
  `tracking_url` TEXT,
  `estimated_delivery` TEXT,
  `shipping_address` LONGTEXT,
  `items` LONGTEXT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `cancelled_at` DATETIME,
  `cancellation_reason` TEXT,
  `cancelled_by` TEXT,
  `customer_remark` TEXT,
  `internal_remark` TEXT,
  `cancellation_reason_internal` TEXT
,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== otp_codes ====================
DROP TABLE IF EXISTS `otp_codes`;
CREATE TABLE `otp_codes` (
  `id` CHAR(36) NOT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `code` VARCHAR(10) NOT NULL,
  `purpose` VARCHAR(32) NOT NULL DEFAULT 'login',
  `is_used` TINYINT(1) NOT NULL DEFAULT 0,
  `expires_at` DATETIME NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_otp_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== product_reviews ====================
DROP TABLE IF EXISTS `product_reviews`;
CREATE TABLE `product_reviews` (
  `id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36),
  `user_name` TEXT NOT NULL,
  `rating` INT NOT NULL,
  `title` TEXT,
  `comment` TEXT,
  `images` LONGTEXT,
  `is_verified_purchase` TINYINT(1),
  `status` TEXT NOT NULL,
  `created_at` DATETIME,
  `updated_at` DATETIME
,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== products ====================
DROP TABLE IF EXISTS `products`;
CREATE TABLE `products` (
  `id` CHAR(36) NOT NULL,
  `name` TEXT NOT NULL,
  `name_hi` TEXT,
  `slug` TEXT NOT NULL,
  `description` TEXT,
  `description_hi` TEXT,
  `price` DECIMAL(12,2),
  `mrp` DECIMAL(12,2),
  `category_id` CHAR(36),
  `image_url` TEXT,
  `images` LONGTEXT,
  `rating` DECIMAL(12,2),
  `reviews_count` INT,
  `badge` TEXT,
  `is_active` TINYINT(1),
  `is_featured` TINYINT(1),
  `concern` TEXT,
  `stock` INT,
  `sku` TEXT,
  `sort_order` INT,
  `sizes` LONGTEXT,
  `features` LONGTEXT,
  `tags` LONGTEXT,
  `meta_title` TEXT,
  `meta_description` TEXT,
  `created_at` DATETIME,
  `updated_at` DATETIME,
  `sale_price` DECIMAL(12,2),
  `sale_starts_at` DATETIME,
  `sale_ends_at` DATETIME,
  `benefits` LONGTEXT,
  `ingredients` LONGTEXT,
  `how_to_use` TEXT,
  `banner_image` TEXT,
  `faqs` LONGTEXT,
  `short_description` TEXT,
  `product_type` TEXT,
  `variations` LONGTEXT,
  `benefits_banner` TEXT,
  `ingredients_banner` TEXT,
  `unit` TEXT,
  `variation_label` TEXT,
  `variation_display` TEXT,
  `banner_video_url` TEXT,
  `variant_matrix` LONGTEXT
,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== profiles ====================
DROP TABLE IF EXISTS `profiles`;
CREATE TABLE `profiles` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36),
  `full_name` VARCHAR(255),
  `phone` VARCHAR(20),
  `email` VARCHAR(255),
  `password_hash` VARCHAR(255),
  `role` VARCHAR(32) NOT NULL DEFAULT 'user',
  `dob` DATE,
  `address` TEXT,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `lead_status` VARCHAR(32),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_phone` (`phone`),
  KEY `idx_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== returns ====================
DROP TABLE IF EXISTS `returns`;
CREATE TABLE `returns` (
  `id` CHAR(36) NOT NULL,
  `order_id` CHAR(36),
  `user_id` CHAR(36),
  `reason` TEXT,
  `status` TEXT,
  `notes` TEXT,
  `refund_amount` DECIMAL(12,2),
  `created_at` DATETIME,
  `updated_at` DATETIME,
  `order_number` TEXT,
  `customer_name` TEXT,
  `customer_phone` TEXT,
  `customer_email` TEXT,
  `return_type` TEXT,
  `product_details` TEXT,
  `admin_notes` TEXT
,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== site_settings ====================
DROP TABLE IF EXISTS `site_settings`;
CREATE TABLE `site_settings` (
  `id` CHAR(36) NOT NULL,
  `key` VARCHAR(191) NOT NULL,
  `value` LONGTEXT,
  `created_at` DATETIME,
  `updated_at` DATETIME
,
  PRIMARY KEY (`id`),
  UNIQUE KEY `site_settings_key_unique` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== suppressed_emails ====================
DROP TABLE IF EXISTS `suppressed_emails`;
CREATE TABLE `suppressed_emails` (
  `id` CHAR(36) NOT NULL,
  `email` TEXT NOT NULL,
  `reason` TEXT NOT NULL,
  `metadata` LONGTEXT,
  `created_at` DATETIME NOT NULL
,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== testimonials ====================
DROP TABLE IF EXISTS `testimonials`;
CREATE TABLE `testimonials` (
  `id` CHAR(36) NOT NULL,
  `name` TEXT NOT NULL,
  `role` TEXT,
  `location` TEXT,
  `rating` INT,
  `content` TEXT NOT NULL,
  `content_hi` TEXT,
  `image_url` TEXT,
  `is_active` TINYINT(1),
  `sort_order` INT,
  `created_at` DATETIME,
  `updated_at` DATETIME
,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== trashed_items ====================
DROP TABLE IF EXISTS `trashed_items`;
CREATE TABLE `trashed_items` (
  `id` CHAR(36) NOT NULL,
  `source_table` TEXT NOT NULL,
  `original_id` TEXT NOT NULL,
  `row_data` LONGTEXT NOT NULL,
  `label` TEXT,
  `deleted_by` CHAR(36),
  `deleted_at` DATETIME NOT NULL,
  `expires_at` DATETIME NOT NULL
,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== user_addresses ====================
DROP TABLE IF EXISTS `user_addresses`;
CREATE TABLE `user_addresses` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `label` TEXT,
  `full_name` TEXT NOT NULL,
  `phone` TEXT NOT NULL,
  `address` TEXT NOT NULL,
  `city` TEXT,
  `state` TEXT,
  `pincode` TEXT,
  `is_default` TINYINT(1),
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL
,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== user_roles ====================
DROP TABLE IF EXISTS `user_roles`;
CREATE TABLE `user_roles` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `role` VARCHAR(50) NOT NULL,
  `created_at` DATETIME
,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

