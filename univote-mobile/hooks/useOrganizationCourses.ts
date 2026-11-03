import { useEffect, useState } from 'react';
import { api, CourseOption } from '@/services/api';

export function useOrganizationCourses(organizationId?: number) {
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setCourses([]);
    setError('');

    if (!organizationId) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    api.getOrganizationCourses(organizationId)
      .then((response) => {
        if (!active) return;
        if (response.data) {
          setCourses(response.data.courses);
        } else {
          setError(response.error || 'Unable to load courses for this department.');
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : 'Unable to load courses for this department.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [organizationId, reloadKey]);

  return {
    courses,
    loading,
    error,
    retry: () => setReloadKey((key) => key + 1),
  };
}
