import React, { useMemo } from "react";
import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Typography } from "@mui/material";
import ClustersSummary from "./ClustersSummary";
import { GameServerBuild } from "../types";
import GameServerBuildsSummary from "./GameServerBuildsSummary";
import TotalSummary from "./TotalSummary";
import { fetchWithTimeout } from "../utils";
import TitlesSummary, { TitlesDetail, TitlesSummaryProps } from "./TitlesSummary";

interface HomeProps {
  clusters: Record<string, Record<string, string>>
}

function Home({ clusters }: HomeProps) {
  const [gsbMap, setGsbMap] = useState<Map<string, Array<GameServerBuild>>>(new Map());
  const [errors, setErrors] = useState<Set<string>>(new Set());

  const groupValues = (data: Map<string, Array<GameServerBuild>>): [Record<string, number>, Record<string, Record<string, number>>, Record<string, Record<string, number>>, TitlesDetail] => {
    
    function emptyValues() {
      return {
        standingBy: 0,
        active: 0,
        pending: 0,
        initializing: 0,
      }
    };
    let total: Record<string, number> = emptyValues();
    let perCluster: Record<string, Record<string, number>> = {};
    let perBuild: Record<string, Record<string, number>> = {};
    let perTitle: TitlesDetail = {};

    const keys = Array.from(data.keys());
    keys.forEach((clusterName) => {
      if (!perCluster[clusterName]) {
        perCluster[clusterName] = emptyValues();
      }
      data.get(clusterName)!.forEach((gsb: GameServerBuild) => {
        let buildName = gsb.metadata.name;
        let titleId = gsb.spec.titleID;
        if (!perBuild[buildName]) {
          perBuild[buildName] = emptyValues();
        }
        if (!perTitle[titleId]) {
          perTitle[titleId] = { ...emptyValues(), status: "Healthy" };  
        }
        
        total.standingBy += gsb.status.currentStandingBy ? gsb.status.currentStandingBy : 0;
        total.active += gsb.status.currentActive ? gsb.status.currentActive : 0;

        perTitle[titleId].standingBy += gsb.status.currentStandingBy ? gsb.status.currentStandingBy : 0;
        perTitle[titleId].active = gsb.status.currentActive ? gsb.status.currentActive : 0;
        perTitle[titleId].pending = gsb.status.currentPending ? gsb.status.currentPending : 0;
        perTitle[titleId].initializing = gsb.status.currentInitializing ? gsb.status.currentInitializing : 0;
        perTitle[titleId].status = gsb.status.health === "Healthy" ? "Healthy" : gsb.status.health === "Unhealthy" ? "Unhealthy" : "Unknown";
        
        perCluster[clusterName].standingBy += gsb.status.currentStandingBy ? gsb.status.currentStandingBy : 0;
        perCluster[clusterName].active += gsb.status.currentActive ? gsb.status.currentActive : 0;

        perBuild[buildName].standingBy += gsb.status.currentStandingBy ? gsb.status.currentStandingBy : 0;
        perBuild[buildName].active += gsb.status.currentActive ? gsb.status.currentActive : 0;
      });
    });
    return [total, perCluster, perBuild, perTitle];
  }

  const getAllBuilds = useCallback(() => {
    let entries = Object.entries(clusters);
    entries.forEach((value) => {
      let [clusterName, endpoints] = value;
      let clusterApi = endpoints.api;
      fetchWithTimeout(clusterApi + "gameserverbuilds", { timeout: 5000 })
        .then(response => {
          if (response.status === 200) {
            return response.json();
          }
          setErrors(prev => new Set(
            prev.add("Couldn't reach cluster '" + clusterName + "' at: " + clusterApi + "gameserverbuilds")
          ));
          return undefined;
        })
        .then(response => {
          if (response && response.items) {
            setGsbMap(prevGsbMap => new Map(prevGsbMap.set(clusterName, response.items)));
          }
        })
        .catch(err => {
          setGsbMap(prevGsbMap => new Map(prevGsbMap.set(clusterName, [])));
          setErrors(prev => new Set(
            prev.add("Couldn't reach cluster '" + clusterName + "' at: " + clusterApi + "gameserverbuilds")
          ));
        });
    });
  }, [clusters]);

  const handleCloseAlert = useCallback((error: string) => {
    setErrors(prev => {
      const newErrors = new Set(prev);
      newErrors.delete(error);
      return newErrors;
    });
  }, []);

  useEffect(() => {
    getAllBuilds();
    const interval = setInterval(getAllBuilds, 5000);
    return () => clearInterval(interval);
  }, [getAllBuilds]);

  const [total, perCluster, perBuild, perTitle] = useMemo(() => groupValues(gsbMap), [gsbMap]);
  const errorMessages = useMemo(() => {
    const errorsArray = Array.from(errors).sort();
    return errorsArray.map((error, index) =>
      <Box key={index} display="flex" justifyContent="center">
        <Alert severity="error" onClose={() => handleCloseAlert(error)}>
          {error}
        </Alert>
      </Box>
    );
  }, [errors, handleCloseAlert]);

  return (
    <React.Fragment>
      {(errors) &&
        <React.Fragment>
          {errorMessages}
        </React.Fragment>
      }
      <Typography variant="h4" component="div" sx={{ marginBottom: "40px" }}>
        Summary
      </Typography>
      <TotalSummary total={total} />
      <Typography variant="h5" gutterBottom component="div">
        Clusters
      </Typography>
      <ClustersSummary perCluster={perCluster} />
      <Typography variant="h5" gutterBottom component="div">
        Builds
      </Typography>
      <GameServerBuildsSummary perBuild={perBuild} />
      <Typography variant="h5" gutterBottom component="div">
        Titles
      </Typography>
      <TitlesSummary perTitle={perTitle} />
    </React.Fragment>
  );
}

export default Home;
