export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          user_id?: string
          full_name?: string | null
          phone?: string | null
          avatar_url?: string | null
          onboarding_completed?: boolean
          gender?: string | null
          email?: string | null
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id: string
          user_id?: string
          full_name?: string | null
          phone?: string | null
          avatar_url?: string | null
          onboarding_completed?: boolean
          gender?: string | null
          email?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          full_name?: string | null
          phone?: string | null
          avatar_url?: string | null
          onboarding_completed?: boolean
          gender?: string | null
          email?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      cart: {
        Row: {
          id: string
          user_id: string
          created_at?: string
        }
        Insert: {
          id?: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          created_at?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          id: string
          cart_id: string
          item_id: string
          quantity: number
          days: number
          created_at?: string
        }
        Insert: {
          id?: string
          cart_id: string
          item_id: string
          quantity?: number
          days?: number
          created_at?: string
        }
        Update: {
          id?: string
          cart_id?: string
          item_id?: string
          quantity?: number
          days?: number
          created_at?: string
        }
        Relationships: []
      }
      items: {
        Row: {
          id: string
          title: string
          brand?: string | null
          category?: string | null
          gender?: string | null
          description?: string | null
          rental_price_per_day: number
          deposit_amount?: number | null
          image_url?: string | null
          is_active?: boolean
          created_at?: string
          name?: string | null
          price?: number | null
          event_category?: string | null
          rating?: number | null
          is_available?: boolean
        }
        Insert: {
          id?: string
          title: string
          brand?: string | null
          category?: string | null
          gender?: string | null
          description?: string | null
          rental_price_per_day: number
          deposit_amount?: number | null
          image_url?: string | null
          is_active?: boolean
          created_at?: string
          name?: string | null
          price?: number | null
          event_category?: string | null
          rating?: number | null
          is_available?: boolean
        }
        Update: {
          id?: string
          title?: string
          brand?: string | null
          category?: string | null
          gender?: string | null
          description?: string | null
          rental_price_per_day?: number
          deposit_amount?: number | null
          image_url?: string | null
          is_active?: boolean
          created_at?: string
          name?: string | null
          price?: number | null
          event_category?: string | null
          rating?: number | null
          is_available?: boolean
        }
        Relationships: []
      }
      addresses: {
        Row: {
          id: string
          user_id: string
          label?: string | null
          full_address: string
          latitude?: number | null
          longitude?: number | null
          geohash?: string | null
          is_default?: boolean
          created_at?: string
          city?: string | null
          postalCode?: string | null
          country?: string | null
          postal_code?: string | null
        }
        Insert: {
          id?: string
          user_id: string
          label?: string | null
          full_address: string
          latitude?: number | null
          longitude?: number | null
          geohash?: string | null
          is_default?: boolean
          created_at?: string
          city?: string | null
          postalCode?: string | null
          country?: string | null
          postal_code?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          label?: string | null
          full_address?: string
          latitude?: number | null
          longitude?: number | null
          geohash?: string | null
          is_default?: boolean
          created_at?: string
          city?: string | null
          postalCode?: string | null
          country?: string | null
          postal_code?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          name: string
          description?: string | null
          category?: string | null
          gender?: string | null
          occasion?: Json | null
          brand?: string | null
          color?: string | null
          images?: string[] | null
          rental_price?: number | null
          price?: number | null
          deposit_amount?: number | null
          mrp?: number | null
          sizes_available?: Json | null
          is_available?: boolean | null
          early_access_until?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          category?: string | null
          gender?: string | null
          occasion?: Json | null
          brand?: string | null
          color?: string | null
          images?: string[] | null
          rental_price?: number | null
          price?: number | null
          deposit_amount?: number | null
          mrp?: number | null
          sizes_available?: Json | null
          is_available?: boolean | null
          early_access_until?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          category?: string | null
          gender?: string | null
          occasion?: Json | null
          brand?: string | null
          color?: string | null
          images?: string[] | null
          rental_price?: number | null
          price?: number | null
          deposit_amount?: number | null
          mrp?: number | null
          sizes_available?: Json | null
          is_available?: boolean | null
          early_access_until?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          id: string
          user_id: string
          delivery_address_id?: string | null
          rental_start_date: string
          rental_end_date: string
          total_amount: number
          deposit_amount?: number
          status?: string
          lifecycle_state?: string
          delivery_eta?: string | null
          payment_method?: string | null
          delivery_fee?: number | null
          subscription_id?: string | null
          order_type?: string | null
          scheduled_slot?: Json | null
          support_tier?: string | null
          rider_id?: string | null
          otp_delivery?: string | null
          otp_return?: string | null
          return_pickup_date?: string | null
          return_time_slot?: string | null
          created_at: string
          updated_at?: string | null
        }
        Insert: {
          id?: string
          user_id: string
          delivery_address_id?: string | null
          rental_start_date: string
          rental_end_date: string
          total_amount: number
          deposit_amount?: number
          status?: string
          lifecycle_state?: string
          delivery_eta?: string | null
          payment_method?: string | null
          delivery_fee?: number | null
          subscription_id?: string | null
          order_type?: string | null
          scheduled_slot?: Json | null
          support_tier?: string | null
          rider_id?: string | null
          otp_delivery?: string | null
          otp_return?: string | null
          return_pickup_date?: string | null
          return_time_slot?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          delivery_address_id?: string | null
          rental_start_date?: string
          rental_end_date?: string
          total_amount?: number
          deposit_amount?: number
          status?: string
          lifecycle_state?: string
          delivery_eta?: string | null
          payment_method?: string | null
          delivery_fee?: number | null
          subscription_id?: string | null
          order_type?: string | null
          scheduled_slot?: Json | null
          support_tier?: string | null
          rider_id?: string | null
          otp_delivery?: string | null
          otp_return?: string | null
          return_pickup_date?: string | null
          return_time_slot?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          size?: string | null
          individual_id?: string | null
          rental_price: number
          deposit_amount?: number
          rental_duration_days?: number
          created_at?: string
        }
        Insert: {
          id?: string
          order_id: string
          product_id: string
          size?: string | null
          individual_id?: string | null
          rental_price: number
          deposit_amount?: number
          rental_duration_days?: number
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string
          size?: string | null
          individual_id?: string | null
          rental_price?: number
          deposit_amount?: number
          rental_duration_days?: number
          created_at?: string
        }
        Relationships: []
      }
      return_requests: {
        Row: {
          id: string
          order_id: string
          reason: string
          pickup_address_id: string
          pickup_slot: string
          status: string
          pickup_eta?: string | null
          rider_id?: string | null
          approved_at?: string | null
          picked_up_at?: string | null
          received_at?: string | null
          completed_at?: string | null
          created_at?: string | null
        }
        Insert: {
          id?: string
          order_id: string
          reason?: string
          pickup_address_id: string
          pickup_slot: string
          status?: string
          pickup_eta?: string | null
          rider_id?: string | null
          approved_at?: string | null
          picked_up_at?: string | null
          received_at?: string | null
          completed_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          order_id?: string
          reason?: string
          pickup_address_id?: string
          pickup_slot?: string
          status?: string
          pickup_eta?: string | null
          rider_id?: string | null
          approved_at?: string | null
          picked_up_at?: string | null
          received_at?: string | null
          completed_at?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      order_support_chats: {
        Row: {
          id: string
          order_id: string
          user_id: string
          message: string
          sender_type: string
          is_read?: boolean | null
          priority?: string | null
          created_at?: string | null
        }
        Insert: {
          id?: string
          order_id: string
          user_id: string
          message: string
          sender_type: string
          is_read?: boolean | null
          priority?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          order_id?: string
          user_id?: string
          message?: string
          sender_type?: string
          is_read?: boolean | null
          priority?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      payment_intents: {
        Row: {
          id: string
          user_id: string
          rental_id: string
          amount: number
          payment_type: string
          status?: string
          gateway_ref?: string | null
          created_at?: string
          expires_at?: string
        }
        Insert: {
          id?: string
          user_id: string
          rental_id: string
          amount: number
          payment_type: string
          status?: string
          gateway_ref?: string | null
          created_at?: string
          expires_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          rental_id?: string
          amount?: number
          payment_type?: string
          status?: string
          gateway_ref?: string | null
          created_at?: string
          expires_at?: string
        }
        Relationships: []
      }
      deliveries: {
        Row: {
          id: string
          rental_id: string
          warehouse_id?: string | null
          delivery_type: "pickup" | "drop" | "return"
          status?: string
          assigned_rider?: string | null
          scheduled_date?: string | null
          completed_at?: string | null
          created_at?: string
        }
        Insert: {
          id?: string
          rental_id: string
          warehouse_id?: string | null
          delivery_type: "pickup" | "drop" | "return"
          status?: string
          assigned_rider?: string | null
          scheduled_date?: string | null
          completed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          rental_id?: string
          warehouse_id?: string | null
          delivery_type?: "pickup" | "drop" | "return"
          status?: string
          assigned_rider?: string | null
          scheduled_date?: string | null
          completed_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      rider_locations: {
        Row: {
          rider_id: string
          lat: number
          lng: number
          updated_at?: string
        }
        Insert: {
          rider_id: string
          lat: number
          lng: number
          updated_at?: string
        }
        Update: {
          rider_id?: string
          lat?: number
          lng?: number
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type?: string
          title: string
          message: string
          order_id?: string | null
          metadata?: Json | null
          is_read?: boolean
          created_at?: string
        }
        Insert: {
          id?: string
          user_id: string
          type?: string
          title: string
          message: string
          order_id?: string | null
          metadata?: Json | null
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          title?: string
          message?: string
          order_id?: string | null
          metadata?: Json | null
          is_read?: boolean
          created_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          id: string
          user_id: string
          push_enabled?: boolean
          orders_delivery?: boolean
          new_arrivals?: boolean
          price_drops?: boolean
          promotions?: boolean
          wishlist_updates?: boolean
          rental_reminders?: boolean
          general_updates?: boolean
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: string
          user_id: string
          push_enabled?: boolean
          orders_delivery?: boolean
          new_arrivals?: boolean
          price_drops?: boolean
          promotions?: boolean
          wishlist_updates?: boolean
          rental_reminders?: boolean
          general_updates?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          push_enabled?: boolean
          orders_delivery?: boolean
          new_arrivals?: boolean
          price_drops?: boolean
          promotions?: boolean
          wishlist_updates?: boolean
          rental_reminders?: boolean
          general_updates?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      device_registrations: {
        Row: {
          id: string
          user_id: string
          device_id: string
          device_name?: string | null
          platform?: string
          push_subscription?: Json | null
          last_active_at?: string
          created_at?: string
        }
        Insert: {
          id?: string
          user_id: string
          device_id: string
          device_name?: string | null
          platform?: string
          push_subscription?: Json | null
          last_active_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          device_id?: string
          device_name?: string | null
          platform?: string
          push_subscription?: Json | null
          last_active_at?: string
          created_at?: string
        }
        Relationships: []
      }
      physical_units: {
        Row: {
          id: string
          item_id: string
          size: string
          unit_code?: string | null
          status?: string
          condition?: string
          warehouse_id?: string | null
          created_at?: string
          warehouse_city?: string | null
          inventory_id?: string | null
        }
        Insert: {
          id?: string
          item_id: string
          size: string
          unit_code?: string | null
          status?: string
          condition?: string
          warehouse_id?: string | null
          created_at?: string
          warehouse_city?: string | null
          inventory_id?: string | null
        }
        Update: {
          id?: string
          item_id?: string
          size?: string
          unit_code?: string | null
          status?: string
          condition?: string
          warehouse_id?: string | null
          created_at?: string
          warehouse_city?: string | null
          inventory_id?: string | null
        }
        Relationships: []
      }
      rentals: {
        Row: {
          id: string
          user_id: string
          inventory_id?: string | null
          physical_unit_id?: string | null
          start_date: string
          end_date: string
          status?: string
          delivery_address?: string | null
          created_at?: string
          expires_at?: string
          booking_period?: unknown
        }
        Insert: {
          id?: string
          user_id: string
          inventory_id?: string | null
          physical_unit_id?: string | null
          start_date: string
          end_date: string
          status?: string
          delivery_address?: string | null
          created_at?: string
          expires_at?: string
          booking_period?: unknown
        }
        Update: {
          id?: string
          user_id?: string
          inventory_id?: string | null
          physical_unit_id?: string | null
          start_date?: string
          end_date?: string
          status?: string
          delivery_address?: string | null
          created_at?: string
          expires_at?: string
          booking_period?: unknown
        }
        Relationships: []
      }
      warehouses: {
        Row: {
          id: string
          name: string
          city: string
          address?: string | null
          pincode?: string | null
          is_active?: boolean
          created_at?: string
        }
        Insert: {
          id?: string
          name: string
          city: string
          address?: string | null
          pincode?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          city?: string
          address?: string | null
          pincode?: string | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      inventory: {
        Row: {
          id: string
          item_id: string
          size?: string | null
          total_stock?: number | null
          available_stock?: number | null
          created_at?: string
          is_active?: boolean
        }
        Insert: {
          id?: string
          item_id: string
          size?: string | null
          total_stock?: number | null
          available_stock?: number | null
          created_at?: string
          is_active?: boolean
        }
        Update: {
          id?: string
          item_id?: string
          size?: string | null
          total_stock?: number | null
          available_stock?: number | null
          created_at?: string
          is_active?: boolean
        }
        Relationships: []
      }
      email_signups: {
        Row: {
          created_at: string
          email: string
          id: string
          source: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          source?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          source?: string | null
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          id: string
          user_id: string
          plan_id: string
          status: string
          current_period_start?: string
          current_period_end: string
          cancel_at_period_end?: boolean
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: string
          user_id: string
          plan_id: string
          status?: string
          current_period_start?: string
          current_period_end: string
          cancel_at_period_end?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          plan_id?: string
          status?: string
          current_period_start?: string
          current_period_end?: string
          cancel_at_period_end?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      subscription_plans: {
        Row: {
          id: string
          name: string
          price: number
          tagline?: string | null
          monthly_items: number
          concurrent_items: number
          max_item_value: number
          free_delivery: boolean
          insurance_included: boolean
          features: Json
          is_active?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
        Insert: {
          id: string
          name: string
          price: number
          tagline?: string | null
          monthly_items: number
          concurrent_items: number
          max_item_value: number
          free_delivery?: boolean
          insurance_included?: boolean
          features?: Json
          is_active?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          price?: number
          tagline?: string | null
          monthly_items?: number
          concurrent_items?: number
          max_item_value?: number
          free_delivery?: boolean
          insurance_included?: boolean
          features?: Json
          is_active?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {}
    Functions: {
      create_entitled_order: {
        Args: {
          p_delivery_address_id: string
          p_items: Json
          p_payment_method?: string | null
          p_order_type?: string
          p_scheduled_slot?: Json | null
          p_delivery_distance_km?: number | null
          p_pop_insurance?: boolean
          p_rental_duration_days?: number
          p_delivery_eta?: string | null
        }
        Returns: Json
      }
      get_checkout_entitlement_summary: {
        Args: {
          p_user_id?: string | null
        }
        Returns: Json
      }
      schedule_order_return: {
        Args: {
          p_order_id: string
          p_pickup_address_id: string
          p_pickup_slot: string
          p_reason?: string | null
        }
        Returns: Json
      }
      approve_return_request: {
        Args: {
          p_return_request_id: string
          p_actor_id: string
        }
        Returns: Json
      }
      receive_return_at_warehouse: {
        Args: {
          p_order_id: string
          p_actor_id: string
        }
        Returns: Json
      }
      assign_order_units: {
        Args: {
          p_order_id: string
          p_actor_id?: string | null
        }
        Returns: Json
      }
    }
    Enums: {}
    CompositeTypes: {}
  }
}

type PublicSchema = Database["public"]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
