import bcrypt from 'bcryptjs';
import { SRI_LANKA_DISTRICTS } from '../config/sriLankaDistricts.js';

export function getInitialSeedState() {
  const adminHash = bcrypt.hashSync('Admin@123', 8);

  const users = [
    {
      _id: 'usr_admin_1',
      name: 'Yaans.lk Marketplace Admin',
      email: 'admin@yaans.lk',
      phone: '0771002000',
      passwordHash: adminHash,
      role: 'admin',
      sellerId: null,
      defaultDistrict: 'Colombo',
      addresses: [],
      wishlist: [],
      isActive: true,
      createdAt: '2026-09-01T08:00:00.000Z'
    }
  ];

  const sellers = [];

  const categories = [
    {
      _id: 'cat_1',
      name: 'Homemade & Spices',
      slug: 'homemade-pantry',
      quadHeadline: 'Sri Lankan Homemade & Pantry',
      description: 'Home-cooked achcharu, roasted Ceylon spices, pure kithul treacle, and traditional snacks.',
      imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&q=80',
      displayOrder: 1,
      showInQuadGrid: true,
      subCategories: [
        {
          name: 'Ceylon Spices',
          slug: 'ceylon-spices',
          imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F3F4F6'
        },
        {
          name: 'Achcharu & Sambol',
          slug: 'achcharu-sambol',
          imageUrl: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F3F4F6'
        },
        {
          name: 'Kithul & Honey',
          slug: 'kithul-honey',
          imageUrl: 'https://images.unsplash.com/photo-1587049352847-4a222e784d38?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F3F4F6'
        },
        {
          name: 'Traditional Sweets',
          slug: 'traditional-sweets',
          imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F3F4F6'
        }
      ]
    },
    {
      _id: 'cat_2',
      name: 'Electronics & Tech',
      slug: 'electronics',
      quadHeadline: 'Plug in with Electronics',
      description: 'Headphones, tablets, speakers, power banks, and PC accessories from verified Colombo sellers.',
      imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80',
      displayOrder: 2,
      showInQuadGrid: true,
      subCategories: [
        {
          name: 'Headphones',
          slug: 'headphones-audio',
          imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F1F5F9'
        },
        {
          name: 'Smartwatches',
          slug: 'smartwatches',
          imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F1F5F9'
        },
        {
          name: 'Bluetooth Speakers',
          slug: 'speakers',
          imageUrl: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F1F5F9'
        },
        {
          name: 'PC Accessories',
          slug: 'pc-accessories',
          imageUrl: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F1F5F9'
        }
      ]
    },
    {
      _id: 'cat_3',
      name: 'Home & Kitchen',
      slug: 'home-kitchen',
      quadHeadline: 'Fantastic Finds for Home',
      description: 'Seasoned clay cookware, coconut wood utensils, kitchen appliances, and Sri Lankan home decor.',
      imageUrl: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=600&q=80',
      displayOrder: 3,
      showInQuadGrid: true,
      subCategories: [
        {
          name: 'Clay Cookware',
          slug: 'clay-cookware',
          imageUrl: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F3F4F6'
        },
        {
          name: 'Kitchen & Dining',
          slug: 'kitchen-dining',
          imageUrl: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F3F4F6'
        },
        {
          name: 'Home Decor',
          slug: 'home-decor',
          imageUrl: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F3F4F6'
        },
        {
          name: 'Storage & Craft',
          slug: 'storage-craft',
          imageUrl: 'https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F3F4F6'
        }
      ]
    },
    {
      _id: 'cat_4',
      name: 'Fashion & Handloom',
      slug: 'fashion-handloom',
      quadHeadline: 'Apparel & Handloom Favorites',
      description: 'Breathable tropical cotton wear, authentic Sri Lankan batik, handloom sarongs, and everyday fashion.',
      imageUrl: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=600&q=80',
      displayOrder: 4,
      showInQuadGrid: true,
      subCategories: [
        {
          name: 'Women Linen & Batik',
          slug: 'womens-wear',
          imageUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F1F5F9'
        },
        {
          name: 'Men Casual & Sarongs',
          slug: 'mens-wear',
          imageUrl: 'https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F1F5F9'
        },
        {
          name: 'Handbags & Totes',
          slug: 'bags-totes',
          imageUrl: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F1F5F9'
        },
        {
          name: 'Kids & Baby',
          slug: 'kids-baby',
          imageUrl: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F1F5F9'
        }
      ]
    },
    {
      _id: 'cat_5',
      name: 'Ayurveda & Beauty',
      slug: 'ayurveda-beauty',
      quadHeadline: 'Unveil Your Radiance',
      description: 'Pure Ceylon herbal hair oils, sandalwood & turmeric skincare, and natural wellness essentials.',
      imageUrl: 'https://images.unsplash.com/photo-1608248597359-0e6d526a6828?auto=format&fit=crop&w=600&q=80',
      displayOrder: 5,
      showInQuadGrid: true,
      subCategories: [
        {
          name: 'Herbal Hair Care',
          slug: 'hair-care',
          imageUrl: 'https://images.unsplash.com/photo-1608248597359-0e6d526a6828?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F3F4F6'
        },
        {
          name: 'Natural Skincare',
          slug: 'skincare',
          imageUrl: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F3F4F6'
        },
        {
          name: 'Essential Oils',
          slug: 'essential-oils',
          imageUrl: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F3F4F6'
        },
        {
          name: 'Herbal Teas',
          slug: 'herbal-teas',
          imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F3F4F6'
        }
      ]
    },
    {
      _id: 'cat_6',
      name: 'Fitness & Everyday Gear',
      slug: 'fitness-daily-deals',
      quadHeadline: 'Gear Up & Value Deals',
      description: 'Home fitness gear, insulated flasks, bags, and practical daily essentials under Rs. 2,500.',
      imageUrl: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=600&q=80',
      displayOrder: 6,
      showInQuadGrid: true,
      subCategories: [
        {
          name: 'Fitness Equipment',
          slug: 'fitness-equipment',
          imageUrl: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F1F5F9'
        },
        {
          name: 'Flasks & Bottles',
          slug: 'flasks-bottles',
          imageUrl: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F1F5F9'
        },
        {
          name: 'Backpacks & Gear',
          slug: 'backpacks-gear',
          imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F1F5F9'
        },
        {
          name: 'Under Rs. 1,500',
          slug: 'under-1500',
          imageUrl: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=400&q=80',
          bgTint: '#F1F5F9'
        }
      ]
    }
  ];

  const products = [];
  const reviews = [];
  const subOrders = [];
  const orders = [];
  const settlements = [];

  const platformConfig = {
    _id: 'cfg_main_1',
    key: 'main_config',
    defaultCommissionPercent: 8.0,
    homemadeCommissionPercent: 5.0,
    codEnabledGlobally: true,
    codMaxOrderLimitLkr: 75000,
    globalFreeShippingMinLkr: 0,
    shippingMode: 'custom', // 'custom' (25-district matrix) or 'flat' (one unified shipping rate for all places)
    flatShippingRateLkr: 350,
    supportPhone: '+94 11 234 5678',
    supportWhatsapp: '+94 77 123 4567',
    districts: SRI_LANKA_DISTRICTS,
    banners: [
      {
        id: 'bnr_1',
        badge: 'ISLANDWIDE CASH ON DELIVERY',
        title: 'Authentic Sri Lankan Homemade & Everyday Essentials',
        subtitle:
          'Shop directly from home kitchens in Kandy, artisans in Galle, and verified tech sellers in Colombo — delivered across all 25 districts.',
        ctaText: 'Explore Homemade Finds',
        ctaLink: '/products?homemade=true',
        imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=1000&q=80',
        bgClass: 'bg-slate-900',
        active: true
      },
      {
        id: 'bnr_2',
        badge: 'DAILY VALUE DEALS IN LKR',
        title: 'Work From Home & Tech Accessories Under Rs. 9,000',
        subtitle:
          'Genuine power banks, noise-cancelling headphones, and laptop stands with seller warranty and same-day Colombo dispatch.',
        ctaText: 'Shop Tech Deals',
        ctaLink: '/products?category=electronics',
        imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1000&q=80',
        bgClass: 'bg-slate-800',
        active: true
      },
      {
        id: 'bnr_3',
        badge: 'EMPOWERING LOCAL VENDORS',
        title: 'Sell on Yaans.lk – Home-Based Sellers & Small Businesses Welcome',
        subtitle:
          'Low 5% homemade commission, automated district delivery fee calculation, and weekly bank settlements.',
        ctaText: 'Become a Seller',
        ctaLink: '/seller/register',
        imageUrl: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=1000&q=80',
        bgClass: 'bg-neutral-900',
        active: true
      }
    ]
  };

  return {
    users,
    sellers,
    categories,
    products,
    reviews,
    subOrders,
    orders,
    settlements,
    platformConfig
  };
}
