/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { TektonItem } from './tektonitem';
import { TektonNode, Command } from '../tkn';

export class PipelineRun extends TektonItem {

    static async describe(treeItem: TektonNode): Promise<void> {
        const pipelinerun = await PipelineRun.getTektonCmdData(treeItem,
            "From which project you want to describe PipelineRun",
            "Select PipelineRun you want to describe");
        if (pipelinerun) PipelineRun.tkn.executeInTerminal(Command.describePipelineRuns(pipelinerun.getParent().getName()));
    }
    
    static async list(treeItem: TektonNode): Promise<void> {
        const application = await PipelineRun.getTektonCmdData(treeItem,
            "From which project you want to describe PipelineRun",
            "Select PipelineRun you want to describe");
            //Maybe it's better to specify the pipeline?
        if (application) PipelineRun.tkn.executeInTerminal(Command.listPipelineRuns());
    }

}