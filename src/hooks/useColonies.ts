import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Colony, ColonyFormData } from '../types/database';

export function useColonies() {
    const [colonies, setColonies] = useState<Colony[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { user } = useAuth();

    const fetchColonies = useCallback(async () => {
        if (!user) return;

        setLoading(true);
        setError(null);

        const { data, error } = await supabase
            .from('colonies')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            setError(error.message);
        } else {
            setColonies(data || []);
        }
        setLoading(false);
    }, [user]);

    useEffect(() => {
        fetchColonies();
    }, [fetchColonies]);

    const createColony = async (formData: ColonyFormData) => {
        if (!user) return { error: new Error('Not authenticated') };

        const { data, error } = await supabase
            .from('colonies')
            .insert({
                user_id: user.id,
                name: formData.name,
                address: formData.address || null,
            })
            .select()
            .single();

        if (!error && data) {
            setColonies((prev) => [data, ...prev]);
        }

        return { data, error };
    };

    const updateColony = async (id: string, formData: Partial<ColonyFormData>) => {
        const { data, error } = await supabase
            .from('colonies')
            .update({
                name: formData.name,
                address: formData.address,
            })
            .eq('id', id)
            .select()
            .single();

        if (!error && data) {
            setColonies((prev) =>
                prev.map((c) => (c.id === id ? data : c))
            );
        }

        return { data, error };
    };

    const deleteColony = async (id: string) => {
        const { error } = await supabase
            .from('colonies')
            .delete()
            .eq('id', id);

        if (!error) {
            setColonies((prev) => prev.filter((c) => c.id !== id));
        }

        return { error };
    };

    return {
        colonies,
        loading,
        error,
        fetchColonies,
        createColony,
        updateColony,
        deleteColony,
    };
}

export function useColony(id: string | undefined) {
    const [colony, setColony] = useState<Colony | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) {
            setLoading(false);
            return;
        }

        const fetchColony = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('colonies')
                .select('*')
                .eq('id', id)
                .single();

            if (error) {
                setError(error.message);
            } else {
                setColony(data);
            }
            setLoading(false);
        };

        fetchColony();
    }, [id]);

    return { colony, loading, error };
}
